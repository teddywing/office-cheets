// Copyright (c) 2024  Teddy Wing
//
// This file is part of Office Cheets.
//
// Office Cheets is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// Office Cheets is distributed in the hope that it will be
// useful, but WITHOUT ANY WARRANTY; without even the implied warranty
// of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Office Cheets If not, see
// <https://www.gnu.org/licenses/>.


// Attachment
// ==========

function Attachment (file_name, content_type, resource_name) {
	this.file_name = file_name;
	this.content_type = content_type;
	this.resource_name = resource_name;
	this.bytes;

	return this;
}


// Office file map
// ===============

function file_name_to_type (file_name) {
	if (file_name.endsWith(".doc")) {
		return 'd';
	}
	else if (file_name.endsWith(".docx")) {
		return 'd';
	}
	else if (file_name.endsWith(".xls")) {
		return 's';
	}
	else if (file_name.endsWith(".xlsx")) {
		return 's';
	}
	else if (file_name.endsWith(".ppt")) {
		return 'p';
	}
	else if (file_name.endsWith(".pptx")) {
		return 'p';
	}

	return '';
}

function file_type_to_docs_path (file_type) {
	if (file_type === 'd') {
		return 'document';
	}
	else if (file_type === 's') {
		return 'spreadsheets';
	}
	else if (file_type === 'p') {
		return 'presentation';
	}

	return '';
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

function open_file_in_google_docs (drive_id, file_type, opener_tab) {
	var docs_type = file_type_to_docs_path(file_type);
	if (!docs_type) {
		throw new Error(`No Docs type for file type '${file_type}' (${drive_id}).`);
	}

	chrome.tabs.create({
		url: `https://docs.google.com/${docs_type}/d/${drive_id}/edit`,
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

				throw new Error(chrome.runtime.lastError);
			}

			options.headers.set('Authorization', 'Bearer ' + token_result.token);
			return fetch(resource, options)
				.then(function(response) {
					// If we get a 401, it means our token was revoked and we
					// need to re-request authorisation.
					if (response.status === 401) {
						console.info(
							'fetch_authenticated',
							'Token revoked 401, removing cached auth token'
						);

						return chrome.identity.removeCachedAuthToken(
							{ token: token_result.token }
						)
							.then(function() {
								return fetch_authenticated(resource, options);
							});
					}

					return response;
				});
		});
}


// Cache
// =====

// chrome.storage.sync items are limited to 8192 bytes. An array triple of:
//
//     ["<space_id>/<message_id>", "<google_drive_file_id>", "<file_type>"]
//
// has a size of around 70 bytes.
//
//     8192 / 70 ~= 117
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

				return null;
			}

			for (var i = 0; i < cache.length; i++) {
				if (cache[i][0] === cache_key) {
					console.info('cache_get_doc', 'Found Drive ID', cache[i][0], cache[i][1]);

					return {
						id: cache[i][1],
						office_cheets_file_type: cache[i][2]
					};
				}
			}

			console.info('cache_get_doc', 'Cache value not found for key', cache_key);
			return null;
		});
}

function cache_set_doc (space_id, message_id, file_id, file_type) {
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
			cache.unshift([cache_key, file_id, file_type]);

			// We only have a limited amount of storage available. To stay
			// within the limits, remove the oldest files from the cache list.
			// These are at the end of the list.
			//
			// Once the limit is reached, old files must be re-downloaded and
			// recreated in Google Drive.
			if (cache.length > CACHE_MAX_ITEMS) {
				var cache_triple = cache.pop();

				console.info(
					'cache_set_doc',
					'Cache at maximum capacity. Removed',
					cache_triple
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
			var file_type = file_name_to_type(drive_upload_response.name);
			if (!file_type) {
				throw new Error(`File type '${drive_upload_response.name}' not supported.`);
			}

			cache_set_doc(
				space_id,
				message_id,
				drive_upload_response.id,
				file_type,
			);

			drive_upload_response.office_cheets_file_type = file_type;

			return drive_upload_response;
		})
		.then(function(drive_upload_response) {
			return open_file_in_google_docs(
				drive_upload_response.id,
				drive_upload_response.office_cheets_file_type,
				tab
			);
		});
}

function open_attachment (message, tab) {
	return cache_get_doc(message.space_id, message.message_id)
		.then(function(file_metadata) {
			if (!file_metadata) {
				return save_attachment_to_drive_and_open(
					message.space_id,
					message.message_id,
					tab
				);
			}

			return open_file_in_google_docs(
				file_metadata.id,
				file_metadata.office_cheets_file_type,
				tab
			);
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
						error_message: error.message,
						group_id: message.group_id,
						message_id: message.message_id
					},
					{ frameId: sender.frameId }
				);
			});
		break;
	}
});
