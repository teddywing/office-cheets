function Attachment (file_name, content_type, download_url) {
	this.file_name = file_name;
	this.content_type = content_type;
	this.download_url = download_url;
	this.bytes;

	return this;
}

function google_chat_name_from_message_id (space_id, message_id) {
	return `spaces/${space_id}/messages/${message_id}.${message_id}`;
}

function fetch_chat_message (google_chat_name, attachment_index) {
	console.info('fetch_chat_message', 'Fetching message for', google_chat_name);

	return fetch_authenticated(
		`https://chat.googleapis.com/v1/${google_chat_name}`
	)
		.then(function(response) { return response.json(); })
		.then(function(message) {
			console.log('fetch_chat_message', message);
			return new Attachment(
				message.attachment[attachment_index].contentName,
				message.attachment[attachment_index].contentType,
				message.attachment[attachment_index].downloadUri
			);
		});
}

function fetch_attachment (attachment) {
	console.info(
		'fetch_attachment',
		'Downloading bytes for attachment',
		attachment
	);

	return fetch_authenticated(attachment.download_url)
		.then(function(response) { return response.arrayBuffer(); })
		.then(function(bytes) {
			attachment.bytes = bytes;
			console.log('fetch_attachment', attachment);
			return attachment;
		});
}

// function upload_to_drive (file_name, content_type, bytes) {
function upload_to_drive (attachment) {
	return fetch(
		'https://www.googleapis.com/upload/drive/v3/files?uploadType=media',
		{
			method: 'POST',
			headers: new Headers({
				'Content-Type': content_type
			}),
			body: attachment.bytes
		}
	);

}

function fetch_authenticated (resource, options) {
	if (!options) {
		options = {};
	}

	if (!options.headers) {
		options.headers = new Headers();
	}

	return chrome.identity.getAuthToken({ interactive: true })
		.then(function(token_result) {
			if (chrome.runtime.lastError) {
				console.error(
					'fetch_authenticated',
					'Authentication error',
					chrome.runtime.lastError
				);
			}

			options.headers.set('Authorization', 'Bearer ' + token_result.token);
			return fetch(resource, options);
		});
}

function save_attachment_to_drive_and_open (google_chat_name) {
	// TODO: Handle chat messages with multiple attachments.
	var attachment_index = 0;

	return fetch_chat_message(google_chat_name, attachment_index)
		.then(fetch_attachment)
		;
		// .then(upload_to_drive);
}
