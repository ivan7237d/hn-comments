'use strict';

/**
 * Keys are tab ids and values are URLs of comment pages.
 */
const commentUrls = {};

const stripHash = url => {
  const hashIndex = url.indexOf('#');
  if (hashIndex == -1) {
    return url;
  }
  return url.slice(0, hashIndex);
};

const getHNComments = async url => {
  const hnSearchParam = 'query=';
  const urlWithoutSlash = url.replace(/\/$/, '');
  const queryURL = 'https://hn.algolia.com/api/v1/search?tags=story&' +
      hnSearchParam + [url].map(encodeURIComponent).join('&' + hnSearchParam);
  const response = await fetch(queryURL);
  const data = await response.json();

  // Filter the matches by URL and sort by number of comments
  const matches =
      data.hits
          .filter(hit => {
            if (!hit.url) {
              return false;
            }
            return stripHash(hit.url.replace(/\/$/, '')) == urlWithoutSlash;
          })
          .sort((l, r) => r.num_comments - l.num_comments);

  if (matches.length > 0) {
    return matches[0];
  }
};

const updateTab = async(tabId, url) => {
  delete commentUrls[tabId];
  chrome.browserAction.setBadgeText({text: '', tabId});
  chrome.browserAction.setTitle({title: 'Checking for HN comments...', tabId});
  url = stripHash(url);
  let comments = await getHNComments(url);
  if (!comments) {
    chrome.browserAction.setTitle(
        {title: 'No HN comments. Click to submit this page.', tabId});
    return;
  }
  chrome.browserAction.setBadgeText(
      {text: comments.num_comments.toString(), tabId});
  chrome.browserAction.setTitle(
      {title: 'Click to open HN comments in a new tab.', tabId});
  commentUrls[tabId] =
      `https://news.ycombinator.com/item?id=${comments.objectID}`;
};

chrome.tabs.onUpdated.addListener(async(tabId, changeInfo, tab) => {
  let url = changeInfo.url;
  if (!url) {
    return;
  }
  await updateTab(tabId, url);
});

chrome.runtime.onInstalled.addListener(async details => {
  if (new Set(['install', 'update']).has(details.reason)) {
    chrome.tabs.query(
        {},
        async tabs =>
            await Promise.all(tabs.map(tab => updateTab(tab.id, tab.url))));
  }
});

chrome.browserAction.onClicked.addListener(async currentTab => {
  const commentUrl = commentUrls[currentTab.id];
  if (commentUrl) {
    chrome.tabs.create({url: commentUrl});
  } else {
    chrome.tabs.create({
      url: `http://news.ycombinator.com/submitlink?u=${encodeURIComponent(
          currentTab.url)}&t=${encodeURIComponent(currentTab.title)}`
    })
  }
});
