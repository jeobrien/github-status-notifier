document.addEventListener('DOMContentLoaded', () => {

  // TODO replace this with api call to https://api.github.com/repos/intercom/{repo}/branches/master/protection/required_status_checks, token needs admin access though
  const REQUIRED_STATUS_CHECKS = {
    embercom: ["buildkite/embercom"],
    intercom: ["buildkite/intercom-development-environment", "buildkite/rubocop"],
  };

  function isPullRequest(url) {
    return url.includes("https://github.com") && url.includes("/pull/");
  }

  function requestPRStatus(repo, number, tabId, lastModified) {
    const url = `https://api.github.com/repos/${repo}/pulls/${number}`;

    return makeRequest(url, lastModified).then(response => {
      saveLastModified(response.url, response.headers.get('Last-Modified'));
      return response.status === 200 ? response.json() : new Promise.resolve();
    }).then(jsonData => {
      return getNotification(jsonData, tabId);
    });
  }

  function requestCommitStatuses(statusResult) {
    const url = `https://api.github.com/repos/${statusResult.repoName}/commits/${statusResult.sha}/status`;
    return makeRequest(url).then(response => {
      return response.json();
    }).then(jsonData => {
      return jsonData;
    });
  }

  function saveLastModified(url, lastModified) {
    if (lastModified) {
      chrome.storage.local.get(null, localItems => {
        let copy = Object.assign({}, localItems);

        for (let key in copy) {
          if (copy[key]["url"] === url) {
            copy[key]["lastModified"] = lastModified;
            chrome.storage.local.set(copy);
          }
        }
      });
    }
  }

  function makeRequest(url, ifModifiedSince) {
    const accessToken = localStorage.getItem('token');
    if (!accessToken) {
      return Promise.reject(new Error('missing token'));
    }
    const headers = {
      Authorization: `token ${accessToken}`,
      'If-Modified-Since': ifModifiedSince || '',
    };

    return fetch(url, { headers });
  }

  function getStatusImg(state) {
    // unknown (merged), blocked (pending or failed), clean (ready), unstable (failed but not required)
    if (state === "merged") {
      return "merged.png";
    }
    if (state === "clean") {
      return "passed.png";
    }
    if (state === "unstable") {
      return "some-failed.png";
    }
    if (state === "blocked") {
      return "blocked.png";
    }
    return "pullrequest.png";
  }

  function getNotification(statusResult, tabId) {
    if (statusResult) {
      return {
        id: statusResult.id,
        title: statusResult.title,
        timeStamp: statusResult.updated_at,
        url: statusResult.url,
        img: 'assets/images/pullrequest.png',
        statusImg: `assets/images/${getStatusImg(statusResult.mergeable_state)}`,
        status: prStatus(statusResult),
        mergeable_state: statusResult.mergeable_state,
        repoName: statusResult.head.repo.full_name,
        number: statusResult.number,
        tabId: tabId,
        sha: statusResult.head.sha,
        lastModified: statusResult.lastModified,
        commentsCount: statusResult.review_comments || 0,
      };
    }
    return undefined;
  }

  function prStatus(statusResult) {
    let mergeable_state = statusResult.mergeable_state;
    // unknown (merged), blocked (pending or failed), clean (ready), unstable (failed but not required)
    if (statusResult.merged) {
      return "Merged";
    }
    if (mergeable_state === "clean" || mergeable_state === 'unstable') {
      return "OK to Merge";
    }
    if (mergeable_state === "blocked") {
      return "Pending";
    }
    return "Unknown";
  }

  function updateStorage(newStatus) {
    if (newStatus) {
      chrome.storage.local.get(null, data => {
        newStatus["lastModified"] = data[newStatus.id] && data[newStatus.id]["lastModified"];
        data[newStatus.id] = newStatus;
        chrome.storage.local.set(data);
      });
    }
  }

  function deleteStatus(tabId) {
    chrome.storage.local.get(null, data => {
      for (let key in data) {
        if (data[key].tabId === tabId) {
          chrome.storage.local.remove(key, () => {});
        }
      }
    });
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function update() {
    chrome.storage.local.get(null, localItems => {
      for (let key in localItems) {
        let existingStatus = localItems[key];
        requestPRStatus(existingStatus.repoName, existingStatus.number, existingStatus.tabId, existingStatus.lastModified).then(updatedStatus => {
          if (updatedStatus && updatedStatus.status === "Pending") {
            requestCommitStatuses(updatedStatus).then(commitStatuses => {
              let statusToShow = capitalizeFirstLetter(commitStatuses.state);
              let imageToShow = updatedStatus.img;
              // if Success but not yet approved, needs approval
              if (commitStatuses.state === "success" && updatedStatus.mergeable_state === "blocked") {
                statusToShow = "Review Required";
                imageToShow = "assets/images/review-required.png";
              }
              let copy = Object.assign(updatedStatus, { status: statusToShow, img: imageToShow });
              updateStorage(copy);
            });
          } else if (updatedStatus) {
            updateStorage(updatedStatus);
          }
        });
      }
    });
  }

  chrome.alarms.create({
    periodInMinutes: 1
  });

  chrome.alarms.onAlarm.addListener(update);

  chrome.notifications.onClicked.addListener(id => {
    let tabId = parseInt(id.split(":")[1]);
    chrome.tabs.update(tabId, { "active": true, "selected": true });
  });

  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    deleteStatus(tabId);
  });

  chrome.webNavigation.onDOMContentLoaded.addListener(tab => {
    if (tab.url === undefined) {
      return;
    } else {
      if (isPullRequest(tab.url)) {
        let info = tab.url.split("github.com/")[1];
        let repo = info.split("/pull/")[0];
        let prNumber = info.split("/pull/")[1].split("/")[0].split("#")[0];
        requestPRStatus(repo, prNumber, tab.tabId).then(initialStatus => {
          updateStorage(initialStatus);
        });
      }
    }
  });

  function _createNotification(notificationId, title, message = "{}") {
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'assets/images/icon-lg.png',
      title: title,
      message: message,
    });
  }
  
  function createNotificationsAsNecessary(oldValue, newValue) {
    if (shouldIgnoreChanges(oldValue, newValue)) {
      return;
    }
    if (shouldCreateNewStatusNotification(oldValue, newValue)) {
      let notificationId = `TabID:${newValue.tabId}:${newValue.status}`;
      _createNotification(notificationId, newValue.title, newValue.status);
    }
    if (shouldCreateNewCommentNotification(oldValue, newValue)) {
      let notificationId = `TabID:${newValue.tabId}:${newValue.commentsCount}`;
      _createNotification(notificationId, newValue.title, "New comment");
    }
  }

  function shouldIgnoreChanges(oldValue, newValue) {
    if (!newValue) return true;
    if (newValue.status === oldValue.status) return true;
    if (newValue.status === "Merged" && !oldValue.status) return true;
    return false;
  }

  function shouldCreateNewStatusNotification(oldValue, newValue) {
    return newValue.status !== "Unknown";
  }

  function shouldCreateNewCommentNotification(oldValue, newValue) {
    return newValue.commentsCount !== oldValue.commentsCount;
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let key in changes) {
      let { oldValue = {}, newValue } = changes[key];
      createNotificationsAsNecessary(oldValue, newValue);
    }
  });

});

// chrome.storage.local.clear()
// chrome.notifications.getAll(all => {
//   console.log(all);
// });
// chrome.storage.local.get(null, data => {
//   console.log(data)
// });
