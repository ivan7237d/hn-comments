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

chrome.tabs.onUpdated.addListener(async(tabId, changeInfo, tab) => {
  let url = changeInfo.url;
  if (!url) {
    return;
  }
  delete commentUrls[tabId];
  chrome.browserAction.setBadgeText({text: '', tabId});
  url = stripHash(url);
  let comments = await getHNComments(url);
  if (!comments) {
    return;
  }
  chrome.browserAction.setBadgeText(
      {text: comments.num_comments.toString(), tabId});
  commentUrls[tabId] =
      `https://news.ycombinator.com/item?id=${comments.objectID}`;
});

chrome.browserAction.onClicked.addListener(async currentTab => {
  const commentUrl = commentUrls[currentTab.id];
  if (commentUrl) {
    chrome.tabs.create({url: commentUrl});
  }
});
