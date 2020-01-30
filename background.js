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
function addNewItems( url , channel , items ) {
	if ( !( channel in channels ) ) {
		let host = hostsTags[new URL( url ).hostname];
		channels[channel] = { "items" : [] , "unread" : 0 , "link" : url , "tags" : [host] , "section" : host };
	}
	let newItems = items.filter( item => channels[channel].items.every( v => v.title != item.title ) );
	if ( newItems.length > 0 ) {
		channels[channel].items.push( ...newItems );
		channels[channel].items.sort( ( a , b ) => a.pubDate < b.pubDate );
		channels[channel].unread = channels[channel].items.filter( v => v.unread ).length;
		browser.storage.local.set( { "channels" : channels } );
	}
}


function onMessage( message , sender , sendResponse ) {
	console.log( message );
	if ( message.markAsRead ) {
		channels[message.channel].items.find( v => v.title == message.markAsRead ).unread = false;
		setUnread( message.channel );
		browser.storage.local.set( { "channels" : channels } );
	}
	if ( message.newItems ) {
		addNewItems( message.url , message.channel , message.newItems );
	}
	if ( message.getData ) {
		sendResponse( data );
	}
}
browser.runtime.onMessage.addListener( onMessage )


let channels;
let data;
browser.storage.local.get( null ).then( v => {
	if ( v.channels == undefined ) {
		data = { "channels" : {} , "sections" : [] , "options" : [] };
	}
	else {
		data = v;
	}
	channels = data.channels;
	browser.storage.onChanged.addListener( onStorageChanged );
	browser.browserAction.onClicked.addListener( () => {
		browser.tabs.create( { "url" : browser.runtime.getURL( "content_page.html" ) } );
	} );
	let url = "https://www.royalroad.com/fiction/syndication/16946";
	// get( url );
	let a = parseXML( responseText );
	addNewItems( "https://www.royalroad.com/fiction/syndication/16946" , a.channel , a.newItems );
	let b = parseXML( responseText3 );
	addNewItems( "https://www.royalroad.com/fiction/syndication/16946" , b.channel , b.newItems );
	let c = parseXML( responseText2 );
	addNewItems( "https://www.youtube.com/feeds/videos.xml?channel_id=UCis5B3Zru-vymPRcbpM1NEA" , c.channel , c.newItems );
	setBadge();
} );



