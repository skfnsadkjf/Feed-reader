import { responseText , responseText2 , responseText3 } from "/example_feeds.js";
import { parseXML , get } from "/get_feed.js";

function setUnread( channel ) {
	channels[channel].unread = channels[channel].items.filter( v => v.unread ).length;
}

function getTaggedChannels( tag ) {
	// return Object.keys( channels ).filter( channel => channels[channel].tags.includes( tag ) );
	// const tagsFunc = v => ( typeof( tags ) == "string" ) ? v == tags : tags.includes( v );
	// const filterFunc = channel => channels[channel].tags.some( tagsFunc );
	// const filterFunc = channel => channels[channel].tags.some( v => tags.includes( v ) );
	// return Object.keys( channels ).filter( filterFunc ); // if args is tags array instead of tag string.

	// tempory solution that checks url rather than tags.
	return Object.keys( channels ).filter( channel => channels[channel].tags.includes( tag ) );
}

function setBadge() {
	let taggedChannels = getTaggedChannels( "royalroad" );
	let x = taggedChannels.reduce( ( acc , channel ) => acc + channels[channel].unread , 0 );
	browser.browserAction.setBadgeText( { "text" : x.toString() } );
}

function onStorageChanged( changes , areaName ) {
	Object.keys( changes ).forEach( key => {
		data[key] = changes[key].newValue;
	} );
	channels = data.channels;
	setBadge();
}
const hostsTags = { "www.royalroad.com" : "royalroad" , "www.youtube.com" : "youtube" };
function addNewItems( channel , items ) {
	let newItems = items.filter( item => channels[channel].items.every( v => v.title != item.title ) );
	if ( newItems.length > 0 ) {
		channels[channel].items.push( ...newItems );
		channels[channel].items.sort( ( a , b ) => a.pubDate < b.pubDate );
		channels[channel].unread = channels[channel].items.filter( v => v.unread ).length;
		browser.storage.local.set( { "channels" : channels } );
	}
}
function addChannelIfNew( href , channel ) {
	if ( !( channel in channels ) ) {
		let host = hostsTags[new URL( href ).hostname];
		channels[channel] = {
			"items" : [] ,
			"unread" : 0 ,
			"link" : href ,
			"tags" : [host] ,
			"section" : host ,
			"title" : channel ,
			"updated" : Date.now() ,
		};
	}
}
function onMessage( message , sender , sendResponse ) {
	if ( message.markAsRead ) {
		channels[message.channel].items.find( v => v.title == message.markAsRead ).unread = false;
		setUnread( message.channel );
		browser.storage.local.set( { "channels" : channels } );
	}
	if ( message.newItems ) {
		addChannelIfNew( message.url , message.channel );
		addNewItems( message.channel , message.newItems );
	}
	if ( message.opmlImport ) {
		message.opmlImport.forEach( v => addChannelIfNew( v.href , v.channel ) );
		browser.storage.local.set( { "channels" : channels } );
	}
	if ( message.jsonImport ) {
		Object.assign( channels , message.jsonImport );
		browser.storage.local.set( { "channels" : channels } );
	}
	if ( message.getItems ) {
		sendResponse( channels[message.getItems].items );
	}
	if ( message.getChannels ) {
		sendResponse( channels );
	}
}
function browserActionOnClicked() {
	let url = browser.runtime.getURL( "content_page.html" );
	browser.tabs.query( { "url" : url } ).then( tabs => {
		if ( tabs.length == 0 ) {
			browser.tabs.create( { "url" : "/content_page.html" } );
		}
		else {
			browser.tabs.update( tabs[0].id , { "active" : true } );
			browser.tabs.reload( tabs[0].id );
			browser.windows.update( tabs[0].windowId , { "focused" : true } );
		}
	} );
}

const timeBetweenUpdates = 86400000; // 86400000; 1 day.
const minimumTimeBetweenUpdates = 5000;
const getWait = lastUpdated => lastUpdated + timeBetweenUpdates - Date.now();
function updateFeeds() {
	let arr = Object.values( channels ).sort( ( a , b ) => a.updated > b.updated );
	if ( arr.length == 0 ) { // if there are no feeds, do nothing and check again every minute.
		return setTimeout( updateFeeds , 1000 );
	}
	let timeUntilUpdateFeeds = getWait( arr[0].updated ); // when positive, updateFeeds() was called too early.
	if ( timeUntilUpdateFeeds > 0 ) {
		return setTimeout( updateFeeds , timeUntilUpdateFeeds );
	}
	arr[0].updated = Date.now();
	get( arr[0].link ).then( data => {
		addNewItems( data.channel , data.newItems );
	} );
	let wait = getWait( arr.length == 1 ? arr[0].updated : arr[1].updated );
	setTimeout( updateFeeds , Math.max( minimumTimeBetweenUpdates , wait ) );
}

let channels;
let data;
browser.runtime.onMessage.addListener( onMessage );
browser.storage.onChanged.addListener( onStorageChanged );
browser.browserAction.onClicked.addListener( browserActionOnClicked );
browser.storage.local.get( null ).then( v => {
	data = v.channels != undefined ? v : { "channels" : {} , "sections" : [] , "options" : [] };
	channels = data.channels;
	setBadge();
	updateFeeds();
} );



