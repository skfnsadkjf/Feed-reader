'use strict';

const timeBetweenUpdates = 86400000; // 86400000; 1 day.
const minimumTimeBetweenUpdates = 2000;
const hostsTags = { "www.royalroad.com" : "royalroad" , "www.youtube.com" : "youtube" };

function parseXML( responseText ) {
	let parser = new DOMParser();
	let xmlDoc = parser.parseFromString( responseText , "text/xml" );
	let rss = xmlDoc.querySelector( "rss" ) != null; // assumes Atom if not rss
	if ( !rss && xmlDoc.querySelector( "feed" ) == null ) {
		return false;
	}
	let channel = xmlDoc.querySelector( rss ? "channel>title" : "feed>title" ).textContent;
	let itemElems = xmlDoc.querySelectorAll( rss ? "item" : "entry" );
	let items = Array.from( itemElems ).map( itemElem => {
		let item = { "unread" : true };
		Array.from( itemElem.children ).forEach( v => {
			if ( v.tagName == "title" ) {
				item.title = v.textContent
			}
			if ( v.tagName == "link" && ( !v.hasAttribute( "rel" ) || v.getAttribute( "rel" ) == "alternate" ) ) {
				item.link = ( rss ) ? v.textContent : v.getAttribute( "href" );
			}
			if ( v.tagName == "pubDate" || v.tagName == "published" ) {
				item.pubDate = new Date( v.textContent ).getTime();
			}
		} );
		return item;
	} );
	return { "channel" : channel , "newItems" : items };
}
function get( url ) {
	return new Promise( ( resolve , reject ) => {
		let xhr = new XMLHttpRequest();
		xhr.open( "GET" , url );
		xhr.onload = e => resolve( parseXML( xhr.responseText ) );
		xhr.onerror = e => reject( xhr.statusText );
		xhr.send();
	} );
}

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
function updateFeed( channel ) {
	console.log( "updating feed: " + channel.title );
	channel.updated = Date.now();
	get( channel.link ).then( data => {
		addNewItems( data.channel , data.newItems );
	} );
}
const getWait = lastUpdated => lastUpdated + timeBetweenUpdates - Date.now();
const setTimer = wait => timer = setTimeout( updateFeedsLoop , wait );
function updateFeedsLoop() {
	clearTimeout( timer );
	let arr = Object.values( channels ).sort( ( a , b ) => a.updated > b.updated );
	if ( arr.length == 0 ) { // if there are no feeds, do nothing and check again every minute.
		return setTimer( 10000 );
	}
	let timeUntilUpdateFeeds = getWait( arr[0].updated ); // when positive, updateFeedsLoop() was called too early.
	if ( timeUntilUpdateFeeds > 0 ) {
		return setTimer( timeUntilUpdateFeeds );
	}
	updateFeed( arr[0] );
	let wait = getWait( arr.length == 1 ? arr[0].updated : arr[1].updated ); // assumes all feeds update at same rate.
	return setTimer( Math.max( minimumTimeBetweenUpdates , wait ) );
}
function updateFeeds( arr ) {
	arr.forEach( v => v.updated = 0 );
	updateFeedsLoop();
}
function onMessage( message , sender , sendResponse ) {
	if ( message.markAsRead ) {
		let item = channels[message.channel].items.find( v => v.title == message.item );
		item.unread = !item.unread;
		setUnread( message.channel );
		browser.storage.local.set( { "channels" : channels } );
	}
	if ( message.markAllRead ) {
		channels[message.markAllRead].items.forEach( v => v.unread = false );
		setUnread( message.markAllRead );
		browser.storage.local.set( { "channels" : channels } );
	}
	if ( message.update ) {
		updateFeed( channels[message.update] );
	}
	if ( message.updateAll ) {
		updateFeeds( Object.values( channels ) );
	}
	if ( message.delete ) {
		delete channels[message.delete];
		browser.storage.local.set( { "channels" : channels } );
	}
	if ( message.opmlImport ) {
		message.opmlImport.forEach( v => addChannelIfNew( v.href , v.channel ) );
		browser.storage.local.set( { "channels" : channels } );
		updateFeeds( message.opmlImport.map( v => channels[v.channel] ) );
	}
	if ( message.jsonImport ) {
		Object.assign( channels , message.jsonImport );
		browser.storage.local.set( { "channels" : channels } );
		updateFeeds( Object.values( message.jsonImport ) );
	}
	if ( message.getItems ) {
		sendResponse( channels[message.getItems].items );
	}
	if ( message.getChannels ) {
		sendResponse( channels );
	}
	if ( message.newChannelURL ) {
		return get( message.newChannelURL ).then( data => {
			addChannelIfNew( message.newChannelURL , data.channel );
			addNewItems( data.channel , data.newItems );
		} , r => "error" );
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

let timer;
let channels;
let data;
browser.runtime.onMessage.addListener( onMessage );
browser.browserAction.onClicked.addListener( browserActionOnClicked );
browser.storage.local.get( null ).then( v => {
	data = v.channels != undefined ? v : { "channels" : {} , "sections" : [] , "options" : [] };
	channels = data.channels;
	setBadge();
	updateFeedsLoop();
} );



