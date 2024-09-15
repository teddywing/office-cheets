function is_chat_frame () {
	return window.location.href.startsWith('https://chat.google.com/u/0/frame');
}

var VALID_FILE_EXTENSIONS = [
	".doc",
	".docx",
	".xls",
	".xlsx",
	".ppt",
	".pptx"
];

function is_valid_file_name (file_name) {
	for (var i = 0; i < VALID_FILE_EXTENSIONS.length; i++) {
		if (file_name.endsWith(VALID_FILE_EXTENSIONS[i])) {
			return true;
		}
	}

	return false;
}

function mark_button_injected (attachment_container) {
	attachment_container.setAttribute('office-cheets-open-button-injected', '');
}

function is_button_injected (attachment_container) {
	return attachment_container.hasAttribute('office-cheets-open-button-injected');
}

function inject_attachment_button (attachment_image, group_id, space_id) {
	var file_name = attachment_image.getAttribute('alt');
	if (!is_valid_file_name(file_name)) {
		return;
	}

	var attachment_container = attachment_image.parentNode.parentNode;
	if (is_button_injected(attachment_container)) {
		return;
	}

	var parent_message_el = attachment_container.closest('[data-topic-id]');

	var open_in_docs_button = document.createElement('button');
	open_in_docs_button.setAttribute('office-cheets-open-button', '');
	open_in_docs_button.setAttribute(
		'class',
		'office-cheets-open-button office-cheets-open-button-hide-loader'
	);
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

	var loader_bounce1 = document.createElement('div');
	loader_bounce1.setAttribute('class', 'office-cheets-loader-double-bounce1');
	var loader_bounce2 = document.createElement('div');
	loader_bounce2.setAttribute('class', 'office-cheets-loader-double-bounce2');
	var loader = document.createElement('div');
	loader.setAttribute('class', 'office-cheets-loader');
	loader.appendChild(loader_bounce1);
	loader.appendChild(loader_bounce2);
	open_in_docs_button.appendChild(loader);

	attachment_container.appendChild(open_in_docs_button);
	mark_button_injected(attachment_container);
}

function display_open_in_progress (open_in_docs_button) {
	open_in_docs_button.disabled = true;
	open_in_docs_button.classList.remove('office-cheets-open-button-hide-loader');
}

function display_open_progress_finished (group_id, message_id) {
	var open_in_docs_button = document.querySelector(
		`[data-group-id="${group_id}"][data-num-unread-words] [data-topic-id="${message_id}"] button[office-cheets-open-button]`
	);

	open_in_docs_button.disabled = false;
	open_in_docs_button.classList.add('office-cheets-open-button-hide-loader');
}

function inject_attachment_buttons (container, group_id, space_id) {
	var attachment_images = container.querySelectorAll(
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
}

// Timeout initialisation after 30 seconds.
var INITIALIZE_ATTACHMENT_BUTTONS_TIMEOUT_COUNT = 30;

function initialize_attachment_buttons () {
	console.info('initialize_attachment_buttons', 'Frame href', window.location.href);

	var chat_container = document.querySelector(
		'c-wiz[data-group-id][data-num-unread-words] > div[jsname]:has(+ div[role="navigation"]) > div > div[jsname]:has(c-wiz[data-topic-id]'
	);
	if (!chat_container) {
		// This should prevent unnecessary work on frames we don't care about,
		// but weren't able to distinguish as the non-chat frame.
		if (INITIALIZE_ATTACHMENT_BUTTONS_TIMEOUT_COUNT === 0) {
			return;
		}

		setTimeout(
			initialize_attachment_buttons,
			1000
		);

		INITIALIZE_ATTACHMENT_BUTTONS_TIMEOUT_COUNT -= 1;

		return;
	}

	console.info('initialize_attachment_buttons', 'Chat container', chat_container);

	var chat_parent = document.querySelector('[data-group-id][data-num-unread-words]');
	var group_id = chat_parent.dataset.groupId;
	var space_id = group_id.substring(group_id.indexOf('/') + 1);

	var messages_observer = new MutationObserver(function(mutation_list) {
		for (var i = 0; i < mutation_list.length; i++) {
			var mutation = mutation_list[i];

			inject_attachment_buttons(mutation.target, group_id, space_id);

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

	// For some reason the mutation observer doesn't run when selecting a
	// different chat Space. Inject the buttons outside of the mutation
	// observer to handle the case where a Space is selected from the UI rather
	// than on page load.
	inject_attachment_buttons(chat_container, group_id, space_id);

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
