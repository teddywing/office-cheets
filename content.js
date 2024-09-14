function is_chat_frame () {
	return window.location.href.includes('hostFrame');
}

function initialize_attachment_buttons () {
	console.info('initialize_attachment_buttons', 'Frame href', window.location.href);

	var chat_container = document.querySelector('[data-group-id]');
	if (!chat_container) {
		setTimeout(
			function() { initialize_attachment_buttons(); },
			1000
		);

		return;
	}

	console.info('initialize_attachment_buttons', 'Chat container', chat_container);

	var space_name = chat_container.dataset.groupId;
	var space_id = space_name.substring(space_name.indexOf('/'));

	var messages = chat_container.querySelectorAll('[data-topic-id]');
	if (!messages.length) {
		return;
	}

	for (var i = 0; i < messages.length; i++) {
		// TODO: Check for multiple file uploads in one message.
		var attachment_image = messages[i].querySelector(
			'img[src^="https://chat.google.com/u/0/api/get_attachment_url"]'
		)

		if (!attachment_image) {
			continue;
		}

		var attachment_container = attachment_image.parentNode.parentNode;
		var open_in_docs_button = document.createElement('div');
		open_in_docs_button.style.position = 'absolute';
		open_in_docs_button.style.bottom = 0;
		open_in_docs_button.style.right = 0;
		open_in_docs_button.textContent = 'Open in Google Docs';
		open_in_docs_button.addEventListener(
			'click',
			function(event) {
				chrome.runtime.sendMessage(
					{
						'message': 'open_attachment',
						'space_id': space_id,
						'message_id': messages[i].dataset.topicId,
					}
				);
			}
		);

		// var file_name = attachment_image.getAttribute('alt');
	}
}

function init () {
	if (!is_chat_frame()) {
		return;
	}

	initialize_attachment_buttons();
}

init();
