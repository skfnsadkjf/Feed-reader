# Firefox feed reader webextension.

Current Features:

* can add feeds via a text box.
* can import or export feeds from/to a json or opml file.
* browser action badge contains total unread items.
  * can filter this to only be total unread items from channels with x tag. Currently hardcoded.
* each item shows it's title, feed title, pubdate and time since pubdate.
* items have a "read" button to declare they've been read.
* feeds can be updated, marked as read, or deleted via a custom context menu.

TODO

* maybe add "*" to badge if there are non-tracked unread entries.

* content script that detects if a page has a feed.
* add manga
  * Not sure how manga would fit into the page without mad scrolling becoming a thing.
  * maybe make each section expandable
  * maybe make a manga channel that has a custom items window.
  * Here's how it be:
    * update and port manga addon. with updates:
      * have export/import data buttons
      * don't check complete/oneshot manga
      * make RSS xml that this addon can read.
    * select the few manga I regularly read and add them to this addon.


bugs:

* when mass updating some updates fail with this error:
  * XML Parsing Error: no root element found
  * Location: moz-extension://35b88c68-ee3e-4f33-8e68-e9d2343caa0d/null
  * Line Number 1, Column 1: null:1:1
  * uncaught exception:
* when mass updating some updates fail with this error:
  * "TypeError: channels[channel] is undefined" in addNewItems().