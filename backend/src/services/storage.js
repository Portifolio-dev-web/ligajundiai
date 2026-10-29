import { randomUUID } from 'node:crypto'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config.js'

function makeClient(endpoint) {
  return new S3Client({
    endpoint,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
  })
}

export const storageClient = makeClient(config.S3_INTERNAL_ENDPOINT)
const presignClient = makeClient(config.S3_PUBLIC_ENDPOINT)

async function ensureBucket(bucket) {
  try {
    await storageClient.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch (error) {
    if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) throw error
    try {
      await storageClient.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (createError) {
      if (createError.name !== 'BucketAlreadyOwnedByYou') throw createError
    }
  }
  const allowedOrigins = config.CORS_ORIGINS.split(',').map((origin) => origin.trim())
  await storageClient.send(new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [{
        AllowedOrigins: allowedOrigins,
        AllowedMethods: ['POST', 'GET', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 300,
      }],
    },
  }))
}

export async function initializeStorage() {
  await ensureBucket(config.S3_BUCKET)
  // S3_PUBLIC_BUCKET continua privado ao nível do S3 (nenhuma política de leitura pública) — o CORS
  // aqui só cobre o POST pré-assinado do envio bruto do logo (ver createSponsorLogoStagingUpload).
  // A exibição em si não fala com o S3 diretamente: sponsorLogosRouter, em routes/sponsors.js, lê o
  // objeto já processado com as credenciais do próprio servidor e repassa os bytes pela origem do
  // site (/api/sponsor-logos/...) — por isso não precisa de leitura pública nem de CORS para GET.
  await ensureBucket(config.S3_PUBLIC_BUCKET)
}

export async function createBiometryUpload(managerId, contentType) {
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const extension = extensions[contentType]
  if (!extension) return null
  const key = `biometry/${managerId}/${randomUUID()}.${extension}`
  const post = await createPresignedPost(presignClient, {
    Bucket: config.S3_BUCKET,
    Key: key,
    Expires: 300,
    Fields: { 'Content-Type': contentType, 'x-amz-meta-manager': managerId },
    Conditions: [
      ['content-length-range', 1, 5 * 1024 * 1024],
      ['eq', '$Content-Type', contentType],
      ['eq', '$x-amz-meta-manager', managerId],
    ],
  })
  return { key, uploadUrl: post.url, uploadFields: post.fields, expiresIn: 300 }
}

export async function createBiometryReadUrl(key) {
  const command = new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key })
  return getSignedUrl(presignClient, command, { expiresIn: 300 })
}

// SEGURANÇA: antes, uma chave de biometria só era validada por prefixo de string
// (biometry/<managerId>/...) — nada confirmava que o objeto existia, que o upload de verdade
// aconteceu, ou que ele não estava sendo reaproveitado de outro cadastro. Isso deixava o cadastro
// de atleta (e as duas etapas de aprovação, que não têm como visualizar a foto) aceitarem uma
// chave forjada ou nunca enviada. Chamado antes do INSERT em createAthlete, não só depois da
// aprovação (biometry.sync em queue.js).
export async function verifyBiometryObject(key, expectedManagerId) {
  let metadata
  try {
    metadata = await storageClient.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }))
  } catch {
    return false
  }
  if (metadata.Metadata?.manager !== String(expectedManagerId)) return false
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(metadata.ContentType)) return false
  if (!metadata.ContentLength || metadata.ContentLength > 5 * 1024 * 1024) return false
  return true
}

export async function readBiometry(key) {
  const metadata = await storageClient.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }))
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(metadata.ContentType) ||
      !metadata.ContentLength || metadata.ContentLength > 5 * 1024 * 1024) {
    throw new Error('Biometry upload is not a supported image or exceeds the size limit')
  }
  const response = await storageClient.send(new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }))
  if (!response.Body) throw new Error('Biometry object has no body')
  return response.Body
}

// ============================================================================
// Logos de patrocinador (S3_PUBLIC_BUCKET) — mesmo padrão de envio pré-assinado acima, mas sem
// metadata de dono vinculante (qualquer admin pode processar o logo de qualquer patrocinador,
// diferente da biometria) e com os objetos finais lidos pelo próprio servidor, não por URL
// assinada entregue ao navegador (ver sponsorLogosRouter em routes/sponsors.js).
// ============================================================================

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export async function createSponsorLogoStagingUpload(adminId, contentType) {
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const extension = extensions[contentType]
  if (!extension) return null
  const key = `sponsor-staging/${adminId}/${randomUUID()}.${extension}`
  const post = await createPresignedPost(presignClient, {
    Bucket: config.S3_PUBLIC_BUCKET,
    Key: key,
    Expires: 300,
    Fields: { 'Content-Type': contentType },
    Conditions: [
      ['content-length-range', 1, 5 * 1024 * 1024],
      ['eq', '$Content-Type', contentType],
    ],
  })
  return { key, uploadUrl: post.url, uploadFields: post.fields, expiresIn: 300 }
}

// Lê e já valida o upload bruto antes de processar (mesma checagem de content-type/tamanho de
// verdade no objeto — não só no que o cliente alegou ao pedir a URL pré-assinada — usada em
// verifyBiometryObject/readBiometry acima).
export async function readSponsorStaging(key) {
  const metadata = await storageClient.send(new HeadObjectCommand({ Bucket: config.S3_PUBLIC_BUCKET, Key: key }))
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(metadata.ContentType) ||
      !metadata.ContentLength || metadata.ContentLength > 5 * 1024 * 1024) {
    throw new Error('Sponsor logo upload is not a supported image or exceeds the size limit')
  }
  const response = await storageClient.send(new GetObjectCommand({ Bucket: config.S3_PUBLIC_BUCKET, Key: key }))
  if (!response.Body) throw new Error('Sponsor logo staging object has no body')
  return streamToBuffer(response.Body)
}

export async function deleteSponsorStaging(key) {
  // Best-effort: o objeto de rascunho não guarda nada sensível (vira um dos 3 formatos públicos
  // minutos depois) — falhar a remoção não deveria derrubar a resposta de sucesso pro admin.
  await storageClient.send(new DeleteObjectCommand({ Bucket: config.S3_PUBLIC_BUCKET, Key: key })).catch(() => {})
}

export async function putSponsorLogoVariant(sponsorId, variant, buffer) {
  await storageClient.send(new PutObjectCommand({
    Bucket: config.S3_PUBLIC_BUCKET,
    Key: `sponsor-logos/${sponsorId}/${variant}.jpg`,
    Body: buffer,
    ContentType: 'image/jpeg',
  }))
}

export async function readSponsorLogoVariant(sponsorId, variant) {
  try {
    return await storageClient.send(new GetObjectCommand({
      Bucket: config.S3_PUBLIC_BUCKET,
      Key: `sponsor-logos/${sponsorId}/${variant}.jpg`,
    }))
  } catch {
    return null
  }
}
