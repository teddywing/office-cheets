function Attachment (file_name, content_type, resource_name) {
	this.file_name = file_name;
	this.content_type = content_type;
	this.resource_name = resource_name;
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
				message.attachment[attachment_index].attachmentDataRef.resourceName
			);
		});
}

function fetch_attachment (attachment) {
	console.info(
		'fetch_attachment',
		'Downloading bytes for attachment',
		attachment
	);

	return fetch_authenticated(
		`https://chat.googleapis.com/v1/media/${attachment.resource_name}?alt=media`
	)
		.then(function(response) { return response.arrayBuffer(); })
		.then(function(buffer) {
			attachment.bytes = new Uint8Array(buffer);
			console.log('fetch_attachment', attachment);
			return attachment;
		});
}

function upload_to_drive (attachment) {
	var boundary = '-------314159265358979323846';
	var delimiter = '\r\n--' + boundary + '\r\n';
	var close_delimiter = '\r\n--' + boundary + '--';

	var metadata = {
		'name': attachment.file_name,
		'mimeType': attachment.content_type
	};

	var content_base64 = btoa(String.fromCharCode.apply(null, attachment.bytes));
	const multipart_request_body =
		delimiter +
		'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
		JSON.stringify(metadata) +
		delimiter +
		'Content-Type: ' + attachment.content_type + '\r\n' +
		'Content-Transfer-Encoding: base64\r\n\r\n' +
		content_base64 +
		close_delimiter;

	return fetch_authenticated(
		'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
		{
			method: 'POST',
			headers: new Headers({
				'Content-Type': 'multipart/related; boundary="' + boundary + '"'
			}),
			body: multipart_request_body
		}
	)
		.then(function(response) { return response.json(); });
}

function open_file_in_google_docs (drive_upload_response) {
	chrome.tabs.create({
		url: `https://docs.google.com/spreadsheets/d/${drive_upload_response.id}/edit`
	});
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
		.then(upload_to_drive)
		.then(open_file_in_google_docs);
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	console.info('onMessage', message, sender);
});
