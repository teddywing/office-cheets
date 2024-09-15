// Attachment
// ==========

function Attachment (file_name, content_type, resource_name) {
	this.file_name = file_name;
	this.content_type = content_type;
	this.resource_name = resource_name;
	this.bytes;

	return this;
}


// Google Chat
// ===========

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


// Google Drive
// ============

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


// Google Docs
// ===========

function open_file_in_google_docs (drive_id, opener_tab) {
	chrome.tabs.create({
		// TODO: Handle other Office formats.
		url: `https://docs.google.com/spreadsheets/d/${drive_id}/edit`,
		windowId: opener_tab.windowId,
		openerTabId: opener_tab.id,
		index: opener_tab.index + 1
	});
}


// Network
// =======

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

			// TODO: If 401 then chrome.identity.removeCachedAuthToken

			options.headers.set('Authorization', 'Bearer ' + token_result.token);
			return fetch(resource, options);
		});
}


// Cache
// =====

// chrome.storage.sync items are limited to 8192 bytes. An array tuple of:
//
//     ["<space_id>/<message_id>", "<google_drive_file_id>"]
//
// has a size of around 64 bytes.
//
//     8192 / 65 ~= 126
//
// Set the maximum items to 100 to allow for some extra room.
var CACHE_MAX_ITEMS = 100;

function cache_get_doc (space_id, message_id) {
	var cache_key = `${space_id}/${message_id}`;

	return chrome.storage.sync.get('cache')
		.then(function(items) {
			var cache = items['cache'];
			if (!cache) {
				console.info('cache_get_doc', 'Cache not initialised');

				return '';
			}

			for (var i = 0; i < cache.length; i++) {
				if (cache[i][0] === cache_key) {
					console.info('cache_get_doc', 'Found Drive ID', cache[i][0], cache[i][1]);

					return cache[i][1];
				}
			}

			console.info('cache_get_doc', 'Cache value not found for key', cache_key);
			return '';
		});
}

function cache_set_doc (space_id, message_id, file_id) {
	return chrome.storage.sync.get('cache')
		.then(function(items) {
			var cache = items['cache'];
			if (!cache) {
				console.info('cache_set_doc', 'Cache not initialised');

				cache = [];
			}

			var cache_key = `${space_id}/${message_id}`;
			console.info('cache_set_doc', 'Setting cache', cache_key, file_id);

			// New items go at the start of the list.
			cache.unshift([cache_key, file_id]);

			// We only have a limited amount of storage available. To stay
			// within the limits, remove the oldest files from the cache list.
			// These are a the end of the list.
			//
			// Once the limit is reached, old files must be re-downloaded and
			// recreated in Google Drive.
			if (cache.length > CACHE_MAX_ITEMS) {
				var cache_pair = cache.pop();

				console.info(
					'cache_set_doc',
					'Cache at maximum capacity. Removed',
					cache_pair
				);
			}

			return chrome.storage.sync.set({ cache: cache });
		});
}


// Actions
// =======

function save_attachment_to_drive_and_open (space_id, message_id, tab) {
	// I originally thought that multiple attachments could be added in a
	// single message (the API's `attachment` field is an array), but it seems
	// that is incorrect. If an attachment is already present in the chat input
	// field in the Google Chat UI, uploading another attachment will prompt
	// you to replace the existing one. Going to leave the attachment index set
	// to 0 accordingly.
	var attachment_index = 0;

	var google_chat_name = google_chat_name_from_message_id(space_id, message_id);

	return fetch_chat_message(google_chat_name, attachment_index)
		.then(fetch_attachment)
		.then(upload_to_drive)
		.then(function(drive_upload_response) {
			cache_set_doc(space_id, message_id, drive_upload_response.id);

			return drive_upload_response;
		})
		.then(function(drive_upload_response) {
			return open_file_in_google_docs(drive_upload_response.id, tab);
		});
}

function open_attachment (message, tab) {
	return cache_get_doc(message.space_id, message.message_id)
		.then(function(drive_id) {
			if (!drive_id) {
				return save_attachment_to_drive_and_open(
					message.space_id,
					message.message_id,
					tab
				);
			}

			return open_file_in_google_docs(drive_id, tab);
		});
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	console.info('onMessage', message, sender);

	switch (message.fn) {
	case 'open_attachment':
		open_attachment(message, sender.tab)
			.then(function() {
				console.info('onMessage', 'Sending on_open_finished');

				chrome.tabs.sendMessage(
					sender.tab.id,
					{
						fn: 'on_open_finished',
						group_id: message.group_id,
						message_id: message.message_id
					},
					{ frameId: sender.frameId }
				);
			})
			.catch(function(error) {
				console.error('onMessage', 'open_attachment', error);

				chrome.tabs.sendMessage(
					sender.tab.id,
					{
						fn: 'on_open_error',
						error: error,
						group_id: message.group_id,
						message_id: message.message_id
					},
					{ frameId: sender.frameId }
				);
			});
		break;
	}
});
