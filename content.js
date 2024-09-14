function get_space_id () {
	var url_parts = window.location.href.split('/');
	var space_id = url_parts[url_parts.length - 1];
	return space_id;
}

function space_idtype () {
	var url_parts = window.location.href.split('/');
	var space_type = url_parts[url_parts.length - 2];
	var space_id = url_parts[url_parts.length - 1];
	return `${space_type}/${space_id}`;
}

function initialize_attachment_buttons () {
	var space_id = get_space_id();
	var space_name = space_idtype();
	var chat_container = document.querySelector(`[data-group-id="${space_name}"]`);

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
	initialize_attachment_buttons();
}

init();
