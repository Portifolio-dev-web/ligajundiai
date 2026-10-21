'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/lib/api'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default function CameraCapture({ teamId, onUploaded, disabled = false, publicRegistration = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraError, setCameraError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [starting, setStarting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [captured, setCaptured] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploadedKey, setUploadedKey] = useState('')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => stopCamera, [stopCamera])
  useEffect(() => {
    if (!captured) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(captured)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [captured])

  const startCamera = async () => {
    setCameraError('')
    setStarting(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador não oferece suporte à câmera. Use HTTPS ou localhost.')
      }
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (error) {
      setCameraError(error.message || 'Não foi possível acessar a câmera.')
    } finally {
      setStarting(false)
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError('A câmera ainda está iniciando.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Não foi possível processar a imagem.')
      return
    }
    context.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Não foi possível capturar a imagem.')
        return
      }
      const file = new File([blob], 'biometria.jpg', { type: 'image/jpeg' })
      if (file.size > MAX_IMAGE_SIZE) {
        setCameraError('A foto excede o limite permitido de 5 MB.')
        return
      }
      setCaptured(file)
      setUploadedKey('')
      onUploaded?.('')
      setCameraError('')
    }, 'image/jpeg', 0.9)
  }

  const uploadPhoto = async () => {
    if (!captured || !teamId) return
    setUploadError('')
    setUploading(true)
    try {
      if (!ALLOWED_TYPES.has(captured.type) || captured.size > MAX_IMAGE_SIZE) {
        throw new Error('A imagem deve ser JPEG, PNG ou WebP e ter no máximo 5 MB.')
      }
      const { uploadUrl, uploadFields, key } = await api(publicRegistration
        ? '/athletes/biometry-upload-public'
        : '/athletes/biometry-upload', {
        method: 'POST',
        body: { team_id: teamId, content_type: captured.type },
      })
      const form = new FormData()
      for (const [name, value] of Object.entries(uploadFields)) form.append(name, value)
      form.append('file', captured, captured.name)
      const response = await fetch(uploadUrl, { method: 'POST', body: form })
      if (!response.ok) throw new Error(`Falha ao enviar a foto para o armazenamento (HTTP ${response.status}).`)
      setUploadedKey(key)
      onUploaded?.(key)
      stopCamera()
    } catch (error) {
      setUploadError(error.message || 'Não foi possível enviar a foto.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Captura biométrica">
      <div>
        <h3 className="font-medium">Foto para identificação biométrica</h3>
        <p className="text-sm text-muted-foreground">
          A imagem será enviada diretamente ao armazenamento seguro; ela não passa pela API.
        </p>
      </div>

      {cameraError && <Alert variant="destructive"><AlertDescription>{cameraError}</AlertDescription></Alert>}
      {uploadError && <Alert variant="destructive"><AlertDescription>{uploadError}</AlertDescription></Alert>}

      {!uploadedKey && (
        <div className="overflow-hidden rounded-md bg-muted">
          {captured
            ? <img src={previewUrl} alt="Foto capturada" className="mx-auto max-h-72 object-contain" />
            : <video ref={videoRef} autoPlay muted playsInline className="mx-auto max-h-72 w-full object-contain" />}
        </div>
      )}

      {uploadedKey
        ? <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>Foto enviada com segurança.</AlertDescription></Alert>
        : <div className="flex flex-wrap gap-2">
          {!captured
            ? <>
              <Button type="button" variant="outline" onClick={startCamera} disabled={disabled || starting || !teamId}>
                <Camera className="h-4 w-4" /> {starting ? 'Abrindo câmera…' : 'Ativar câmera'}
              </Button>
              {streamRef.current && <Button type="button" onClick={capturePhoto} disabled={disabled}>Capturar foto</Button>}
            </>
            : <>
              <Button type="button" variant="outline" onClick={() => { setCaptured(null); setUploadError(''); startCamera() }} disabled={disabled || uploading}>
                <RefreshCw className="h-4 w-4" /> Tirar outra
              </Button>
              <Button type="button" onClick={uploadPhoto} disabled={disabled || uploading || !teamId}>
                <Upload className="h-4 w-4" /> {uploading ? 'Enviando…' : 'Enviar foto'}
              </Button>
            </>}
        </div>}
      {!teamId && <p className="text-sm text-muted-foreground">Selecione uma equipe aprovada antes de ativar a câmera.</p>}
    </section>
  )
}
