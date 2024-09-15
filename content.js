function is_chat_frame () {
	return window.location.href.includes('hostFrame');
}

function is_preview_frame () {
	return window.location.href.includes('spareFrame');
}

function mark_button_injected (attachment_container) {
	attachment_container.setAttribute('office-cheets-open-button-injected', '');
}

function is_button_injected (attachment_container) {
	return attachment_container.hasAttribute('office-cheets-open-button-injected');
}

function inject_attachment_button (attachment_image, group_id, space_id) {
	// TODO: Don't inject button for non-Office files.

	var attachment_container = attachment_image.parentNode.parentNode;
	if (is_button_injected(attachment_container)) {
		return;
	}

	var parent_message_el = attachment_container.closest('[data-topic-id]');

	var open_in_docs_button = document.createElement('button');
	open_in_docs_button.setAttribute('office-cheets-open-button', '');
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
					group_id: group_id,
					space_id: space_id,
					message_id: parent_message_el.dataset.topicId,
				}
			);

			display_open_in_progress(open_in_docs_button);
		}
	);

	attachment_container.appendChild(open_in_docs_button);
	mark_button_injected(attachment_container);
	// var file_name = attachment_image.getAttribute('alt');
}

function display_open_in_progress (open_in_docs_button) {
	open_in_docs_button.disabled = true;

	// TODO: Add spinner
}

function display_open_progress_finished (group_id, message_id) {
	var open_in_docs_button = document.querySelector(
		`[data-group-id="${group_id}"][data-num-unread-words] [data-topic-id="${message_id}"] button[office-cheets-open-button]`
	);

	open_in_docs_button.disabled = false;
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
	var group_id = chat_parent.dataset.groupId;
	var space_id = group_id.substring(group_id.indexOf('/') + 1);

	var messages_observer = new MutationObserver(function(mutation_list) {
		for (var i = 0; i < mutation_list.length; i++) {
			var mutation = mutation_list[i];

			var attachment_images = mutation.target.querySelectorAll(
				'img[src^="https://chat.google.com/u/0/api/get_attachment_url"]'
			)

			for (
				var attachment_index = 0;
				attachment_index < attachment_images.length;
				attachment_index++
			) {
				inject_attachment_button(
					attachment_images[attachment_index],
					group_id,
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

function initialize_preview_button () {
	var preview_open_container = document.createElement('div');
	preview_open_container.style.display = 'inline-block';

	var preview_open_button = document.createElement('button');
	preview_open_button.textContent = 'Open';

	preview_open_container.appendChild(preview_open_button);

	var body_observer = new MutationObserver(function(mutation_list, observer) {
		for (var i = 0; i < mutation_list.length; i++) {
			var mutation = mutation_list[i];

			console.log('@@@@', mutation.addedNodes);

			for (var j = 0; j < mutation.addedNodes.length; j++) {
				var node = mutation.addedNodes[j];

				if (node.getAttribute('role') !== 'dialog') {
					continue;
				}

				var action_buttons_container = node.querySelector(
					'div[role="toolbar"] > div > div:last-child > div:last-child > div:last-child'
				);

				action_buttons_container.prepend(preview_open_container);

				return;
			}

			// var preview_toolbar = document.querySelector(
			// 	'div[role="dialog"] div[role="toolbar"]'
			// );
		}
	});

	body_observer.observe(
		document.body,
		{ childList: true }
	);
}

function init () {
	if (is_chat_frame()) {
		initialize_attachment_buttons();
	}

	if (is_preview_frame()) {
		initialize_preview_button();
	}
}

function on_open_finished (message) {
	display_open_progress_finished(message.group_id, message.message_id);
}

function on_open_error (message) {
	display_open_progress_finished(message.group_id, message.message_id);
	alert(`Error: ${message.error_message} Could not open attachment.`);
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	console.info('Office Cheets', 'onMessage', message, sender);

	switch (message.fn) {
	case 'on_open_finished':
		on_open_finished(message);
		break;
	case 'on_open_error':
		on_open_error(message);
		break;
	}
});

init();
