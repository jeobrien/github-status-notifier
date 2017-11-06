# GitHub Status Notifier

> A Chrome extension to display your GitHub PR status notifications

## What it does

- Desktop notifications when a CI build passes, fails, gets approved, or is merged
- Popup shows the status of each PR and links to it

*You need to add a token in the options on setup.*

![](screenshot.png)
![](screenshot-webstore2.png)


## To run this extension locally

- Clone the repo
- Go to chrome://extensions
- Click to enable Developer mode
- Click on Load unpacked extension and select the cloned repo
- Enable the extension

## How it works

Whenever a tab is open with a pull request, the background page requests the status of the PR and its head commit from the Github API using your access token to authenticate.

It stores the status and the last modified timestamp, and then polls the status API every minute to check for new updates. Since we are using the 'If Modified Since' header, any response that is a 304 Not Modified does not count towards API rate limits.
