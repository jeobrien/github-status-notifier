const divContainer = document.getElementById('container');
const spinner = document.createElement('img');
spinner.classList.add('spinner');
divContainer.classList.add('container');
spinner.src = 'assets/images/loading.gif';

function renderPopup() {
  chrome.storage.local.get(null, localItems => {
    if (localStorage.getItem('token') === undefined || localStorage.getItem('token') === null) {
      renderSetting();
    } else if (localItems) {
      renderStatuses(localItems);
    } else {
      renderSpinner();
    }
  });
}

function renderSetting() {
  const divTitle = document.createElement('div');
  const link = document.createElement('a');
  link.text = 'Settings';
  link.classList.add('center');
  divTitle.classList.add('center');
  divTitle.textContent = 'Please click here to add your Github access token.';
  divContainer.appendChild(divTitle);
  divContainer.appendChild(link);
  link.addEventListener('click', _openSettings);
}

function _openSettings() {
  const url = `chrome://extensions/?options=${chrome.runtime.id}`;
  chrome.tabs.create({'url': url});
}

function renderStatuses(notifications) {
  let content;
  if (Object.keys(notifications).length > 0) {
    const groups = _groupNotifications(notifications);
    content = _groupsNode(groups);
  } else {
    content = document.createElement('div');
    content.classList.add('center');
    content.textContent = 'Open a tab with a PR to see its status here.';
  }
  divContainer.innerHTML = '';
  divContainer.appendChild(content);
}

function _groupsNode(groups) {
  const divGroups = document.createElement('div');

  for (var groupName in groups) {
    const divGroup = _groupNode(groupName, groups[groupName]);
    divGroups.appendChild(divGroup);
  }

  return divGroups;
}

function _groupNode(groupName, notifications) {
  const divGroup = document.createElement('div');
  const divTitle = document.createElement('div');
  divGroup.classList.add('group');
  divTitle.classList.add('group-title');
  divTitle.textContent = groupName;

  divGroup.appendChild(divTitle);
  divGroup.appendChild(_notificationsNode(notifications));

  return divGroup;
}

function _notificationsNode(notifications) {
  const divNotifications = document.createElement('div');
  divNotifications.classList.add('notifications');
  notifications.forEach(notification => {
    const itemDiv = _notificationItemNode(notification);
    divNotifications.appendChild(itemDiv);
  });

  return divNotifications;
}

function _notificationItemNode(notification) {
  const link = document.createElement('a');
  const itemDiv = document.createElement('div');

  itemDiv.classList.add('row');
  itemDiv.dataset.id = notification.id;

  itemDiv.appendChild(_iconNode(notification));
  itemDiv.appendChild(_titleNode(notification));
  itemDiv.appendChild(_statusNode(notification));

  itemDiv.addEventListener("click", () => {
    _goToTab(notification);
  }, false);

  link.appendChild(itemDiv);
  return itemDiv;
}

function _goToTab(notification) {
  chrome.tabs.update(notification.tabId, {"active": true, "highlighted": true});
}

function _iconNode(notification) {
  const container = document.createElement('div');
  const iconImg = document.createElement('img');
  container.classList.add('icon');
  container.appendChild(iconImg);
  iconImg.src = notification.img;

  return container;
}

function _titleNode(notification) {
  const container = document.createElement('div');
  const titleSpan = document.createElement('span');
  container.classList.add('title');
  container.appendChild(titleSpan);
  titleSpan.textContent = notification.title;

  return container;
}

function _statusNode(notification) {
  const container = document.createElement('div');

  const titleSpan = document.createElement('span');
  container.classList.add('status');
  container.classList.add(notification.mergeable_state);
  container.appendChild(titleSpan);
  titleSpan.textContent = notification.status;

  return container;
}

function _groupNotifications(notifications) {
  let notificationsByGroup = {};
  for (var id in notifications) {
    const notification = notifications[id];
    const groupName = notification.repoName;
    if (notificationsByGroup[groupName] === undefined) {
      notificationsByGroup[groupName] = [];
    }

    notificationsByGroup[groupName].push(notification);
  }

  return notificationsByGroup;
}

function renderSpinner() {
  divContainer.innerHTML = '';
  divContainer.appendChild(spinner);
}

document.addEventListener('DOMContentLoaded', () => {
  renderPopup();
});
