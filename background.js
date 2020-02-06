'use strict';

const timeBetweenUpdates = 21600000; // 86400000; 1 day.
const minimumTimeBetweenUpdates = 4000;
const hostsTags = { "www.royalroad.com" : "royalroad" , "www.youtube.com" : "youtube" };

function parseXML( responseText ) {
	let parser = new DOMParser();
	let xmlDoc = parser.parseFromString( responseText , "text/xml" );
	let rss = xmlDoc.querySelector( "rss" ) != null; // assumes Atom if not rss
	if ( !rss && xmlDoc.querySelector( "feed" ) == null ) {
		return false;
	}
	let title = xmlDoc.querySelector( rss ? "channel>title" : "feed>title" ).textContent;
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
	return { "title" : title , "newItems" : items };
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


function getTaggedChannels( tag ) {
	return Object.values( channels ).filter( channel => channel.tags.includes( tag ) );
}
function setBadge() {
	let taggedChannels = getTaggedChannels( "royalroad" );
	let x = taggedChannels.reduce( ( acc , channel ) => acc + channel.unread , 0 );
	browser.browserAction.setBadgeText( { "text" : x.toString() } );
}
function setUnread( channel ) {
	channel.unread = channel.items.filter( v => v.unread ).length;
	setBadge();
	browser.storage.local.set( { [channel.title] : channel } );
}
function addNewItems( channel , items ) {
	let newItems = items.filter( item => channel.items.every( v => v.title != item.title ) );
	if ( newItems.length > 0 ) {
		channel.items.push( ...newItems );
		channel.items.sort( ( a , b ) => a.pubDate < b.pubDate );
		channel.unread = channel.items.filter( v => v.unread ).length;
		browser.storage.local.set( { [channel.title] : channel } );
	}
}
function addChannelIfNew( href , title ) {
	if ( !( title in channels ) ) {
		let host = hostsTags[new URL( href ).hostname];
		channels[title] = {
			"items" : [] ,
			"unread" : 0 ,
			"link" : href ,
			"tags" : [host] ,
			"section" : host ,
			"title" : title ,
			"updated" : Date.now() ,
		};
	}
}
function updateFeed( channel ) {
	console.log( "updating feed: " + channel.title );
	channel.updated = Date.now();
	browser.storage.local.set( { [channel.title] : channel } );
	get( channel.link ).then( data => {
		addNewItems( channels[data.title] , data.newItems );
		setBadge();
	} );
}
function updateFeedsLoop() {
	clearTimeout( timer );
	let arr = Object.values( channels );
	let next = arr.reduce( ( acc , v ) => v.updated < acc.updated ? v : acc , { "updated" : Infinity } );
	let wait = next.updated + timeBetweenUpdates - Date.now();
	if ( wait < 0 ) {
		updateFeed( next );
	}
	timer = setTimeout( updateFeedsLoop , Math.max( minimumTimeBetweenUpdates , wait ) );
}
function updateFeeds( arr ) {
	arr.forEach( v => v.updated = 0 );
	updateFeedsLoop();
}
function onMessage( message , sender , sendResponse ) {
	let channel = channels[message.title];
	if ( message.markAsRead ) {
		let item = channel.items.find( v => v.title == message.item );
		item.unread = !item.unread;
		setUnread( channel );
	}
	if ( message.markAllRead ) {
		channel.items.forEach( v => v.unread = false );
		setUnread( channel );
	}
	if ( message.update ) {
		updateFeed( channel );
	}
	if ( message.updateAll ) {
		updateFeeds( Object.values( channels ) );
	}
	if ( message.delete ) {
		delete channels[message.title];
		setBadge();
		browser.storage.local.remove( channel.title );
	}
	if ( message.opmlImport ) {
		message.opmlImport.forEach( v => addChannelIfNew( v.href , v.title ) );
		browser.storage.local.set( channels );
		updateFeeds( message.opmlImport.map( v => channels[v.title] ) );
	}
	if ( message.jsonImport ) {
		Object.assign( channels , message.jsonImport );
		browser.storage.local.set( channels );
		updateFeeds( Object.values( message.jsonImport ) );
	}
	if ( message.getItems ) {
		sendResponse( channel.items );
	}
	if ( message.getChannels ) {
		sendResponse( channels );
	}
	if ( message.newChannelURL ) {
		return get( message.newChannelURL ).then( data => {
			addChannelIfNew( message.newChannelURL , data.title );
			addNewItems( channels[data.title] , data.newItems );
			updateFeedsLoop();
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
browser.runtime.onMessage.addListener( onMessage );
browser.browserAction.onClicked.addListener( browserActionOnClicked );
browser.storage.local.get( null ).then( v => {
	channels = v != undefined ? v : {};
	browser.browserAction.setBadgeBackgroundColor( { "color" : "#2222ff" } );
	setBadge();
	updateFeedsLoop();
} );



