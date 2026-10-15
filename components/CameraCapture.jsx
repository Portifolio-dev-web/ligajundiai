'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export default function CameraCapture({ disabled = false, teamId, onUploaded, onError }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => () => stopCamera(), [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
  }

  async function startCamera() {
    setMessage('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Este navegador não permite acesso à câmera. Use HTTPS ou localhost.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOpen(true)
    } catch (error) {
      setMessage(error.name === 'NotAllowedError'
        ? 'Permita o acesso à câmera nas configurações do navegador.'
        : 'Não foi possível iniciar a câmera.')
      onError?.(error)
    }
  }

  async function captureAndUpload() {
    const video = videoRef.current
    if (!video?.videoWidth || !video?.videoHeight) {
      setMessage('A câmera ainda não está pronta.')
      return
    }

    setUploading(true)
    setMessage('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      const image = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível capturar a imagem.')), 'image/jpeg', 0.9)
      })
      if (image.size > MAX_IMAGE_BYTES) throw new Error('A foto excede o limite de 5 MB.')

      const upload = await api('/athletes/biometry-upload', {
        method: 'POST',
        body: { content_type: 'image/jpeg', ...(teamId ? { team_id: teamId } : {}) },
      })
      const form = new FormData()
      for (const [key, value] of Object.entries(upload.uploadFields)) form.append(key, value)
      form.append('file', image, 'biometria.jpg')
      const response = await fetch(upload.uploadUrl, {
        method: 'POST',
        credentials: 'omit',
        body: form,
      })
      if (!response.ok) throw new Error('O armazenamento recusou o envio da foto. Tente novamente.')

      onUploaded?.({ key: upload.key, url: upload.uploadUrl })
      setMessage('Foto enviada com segurança.')
      stopCamera()
    } catch (error) {
      setMessage(error.message || 'Falha no envio da foto.')
      onError?.(error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-3" aria-label="Captura de foto biométrica">
      <div className="overflow-hidden rounded-lg bg-slate-950">
        {cameraOpen ? (
          <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-white/70">
            <CameraOff className="mr-2 h-5 w-5" /> Câmera desligada
        </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!cameraOpen ? (
          <Button type="button" variant="outline" onClick={startCamera} disabled={disabled || uploading}>
            <Camera className="mr-2 h-4 w-4" /> Abrir câmera
          </Button>
        ) : (
          <>
            <Button type="button" onClick={captureAndUpload} disabled={disabled || uploading}>
              <Upload className="mr-2 h-4 w-4" /> {uploading ? 'Enviando…' : 'Capturar e enviar'}
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera} disabled={uploading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Fechar câmera
            </Button>
          </>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        A imagem é enviada diretamente ao armazenamento seguro; ela não passa pelo servidor da API nem é enviada como Base64.
      </p>
    </section>
  )
}
