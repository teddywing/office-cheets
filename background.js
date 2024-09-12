function fetch_attachment (download_url) {
	return fetch(download_url)
		.then(function(response) {
		});
}

function upload_to_drive (file_name, content_type, bytes) {
	return fetch(
		'https://www.googleapis.com/upload/drive/v3/files?uploadType=media',
		{
			method: 'POST',
			headers: new Headers({
				'Content-Type': content_type
			}),
			body: bytes
		}
	);
}
