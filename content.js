function is_chat_frame () {
	return window.location.href.includes('hostFrame');
}

function initialize_attachment_buttons () {
	console.info('initialize_attachment_buttons', 'Frame href', window.location.href);

	var chat_container = document.querySelector(
		'c-wiz[data-group-id][data-num-unread-words] > div[jsname]:has(+ div[role="navigation"]) > div > div[jsname]:has(c-wiz[data-topic-id]'
	);
	if (!chat_container) {
		setTimeout(
			initialize_attachment_buttons,
			1000
		);

		return;
	}

	console.info('initialize_attachment_buttons', 'Chat container', chat_container);

	var chat_parent = document.querySelector('[data-group-id][data-num-unread-words]');
	var space_name = chat_parent.dataset.groupId;
	var space_id = space_name.substring(space_name.indexOf('/') + 1);

	// TODO: Mutation observer.
	var messages_observer = new MutationObserver(function(mutation_list) {
		for (var i = 0; i < mutation_list.length; i++) {
			var mutation = mutation_list[i];

			for (var j = 0; j < mutation.addedNodes.length; j++) {
				var node = mutation.addedNodes[j];

				console.log('###', node);
				if (!node.hasAttribute('data-topic-id')) {
					continue;
				}

				var message_group = mutation.target;
				debugger;
			}
		}
	});

	messages_observer.observe(
		chat_container,
		{
			childList: true
			// subtree: true
		}
	);

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
