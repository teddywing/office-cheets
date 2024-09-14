function is_chat_frame () {
	return window.location.href.includes('hostFrame');
}

function mark_button_injected (attachment_container) {
	attachment_container.setAttribute('office-cheets-open-button-injected', '');
}

function is_button_injected (attachment_container) {
	return attachment_container.hasAttribute('office-cheets-open-button-injected');
}

function inject_attachment_button (attachment_image, space_id, message_id) {
	// TODO: Check for multiple file uploads in one message.
	// var attachment_image = message_el.querySelector(
	// 	'img[src^="https://chat.google.com/u/0/api/get_attachment_url"]'
	// )
    //
	// if (!attachment_image) {
	// 	return;
	// }

	var attachment_container = attachment_image.parentNode.parentNode;
	if (is_button_injected(attachment_container)) {
		return;
	}

	var parent_message_el = attachment_container.closest('[data-topic-id]');

	var open_in_docs_button = document.createElement('div');
	open_in_docs_button.style.position = 'absolute';
	open_in_docs_button.style.bottom = 0;
	open_in_docs_button.style.right = 0;
	open_in_docs_button.textContent = 'Open in Google Docs';
	open_in_docs_button.addEventListener(
		'click',
		function(event) {
			event.stopPropagation();

			chrome.runtime.sendMessage(
				{
					fn: 'open_attachment',
					space_id: space_id,
					message_id: parent_message_el.dataset.topicId,
				}
			);
		}
	);

	attachment_container.appendChild(open_in_docs_button);
	mark_button_injected(attachment_container);
	// var file_name = attachment_image.getAttribute('alt');
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

			var attachment_images = mutation.target.querySelectorAll(
				'img[src^="https://chat.google.com/u/0/api/get_attachment_url"]:not([office-cheets-open-button-injected])'
			)

			for (
				var attachment_index = 0;
				attachment_index < attachment_images.length;
				attachment_index++
			) {
				inject_attachment_button(
					attachment_images[attachment_index],
					space_id
				);
			}

			// for (var j = 0; j < mutation.addedNodes.length; j++) {
			// 	var node = mutation.addedNodes[j];
            //
			// 	console.log('###', node);
			// 	if (!node.hasAttribute('data-topic-id')) {
			// 		continue;
			// 	}
            //
			// 	var message_group = mutation.target;
			// 	debugger;
			// }
		}
	});

	messages_observer.observe(
		chat_container,
		{
			childList: true,
			subtree: true
		}
	);

	// var messages = chat_container.querySelectorAll('[data-topic-id]');
	// for (var i = 0; i < messages.length; i++) {
	// 	inject_attachment_button(messages[i]);
	// }
}

function init () {
	if (!is_chat_frame()) {
		return;
	}

	initialize_attachment_buttons();
}

init();
