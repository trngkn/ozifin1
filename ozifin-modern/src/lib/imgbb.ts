export async function uploadToImgBB(base64Image: string): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;

    if (!apiKey) {
        throw new Error('ImgBB API key not configured');
    }

    const formData = new FormData();
    formData.append('image', base64Image.split(',')[1]); // Remove data:image prefix

    const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${apiKey}`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        throw new Error('Failed to upload image to ImgBB');
    }

    const data = await response.json();
    return data.data.url;
}

export async function uploadMultipleToImgBB(base64Images: string[]): Promise<string[]> {
    const uploadPromises = base64Images.map(img => uploadToImgBB(img));
    return Promise.all(uploadPromises);
}
