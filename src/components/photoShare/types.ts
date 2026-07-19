export interface SharedPhoto {
  id: string
  name: string
  uploader: string
  createdTime: string
  width: number | null
  height: number | null
  thumbUrl: string
  viewUrl: string
  downloadUrl: string
}

export interface PhotosApiResponse {
  ok: boolean
  photos?: SharedPhoto[]
  error?: string
}
