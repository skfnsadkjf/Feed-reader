import { get } from "/get_feed.js";

const dateOptions = { "weekday" : "short" , "year" : "numeric" , "month" : "short" , "day" : "2-digit" ,
	"hour" : "2-digit" , "minute" : "2-digit" , "second" : "2-digit" , "hour12" : false };
const times = [0 , 1000 , 60000 , 3600000 , 86400000 , 604800000 , 2419200000 , 31536000000 , Infinity];
const periods = ["" , "millisecond" , "second" , "minute" , "hour" , "day" , "week" , "month" , "year"];
function getDate( pubDate ) {
	let date = new Date( pubDate );
	let x = Date.now() - date;
	let i = times.findIndex( v => x < v );
	let num = Math.floor( x / times[i-1] );
	let word = periods[i] + ( num >= 2 ? "s" : "" );
	return date.toLocaleString( "en-US" , dateOptions ) + " (" + num + " " + word + ")";
}
const dragFunc = e => document.documentElement.style.setProperty( "--leftPanelWidth", e.clientX + "px" );
function dragBar( e ) {
	document.addEventListener( "mousemove" , dragFunc );
	document.addEventListener( "mouseup" , ( e ) => {
		document.removeEventListener( "mousemove" , dragFunc );
	} );
	e.preventDefault();
	e.stopPropagation();
}
function getItem( elem ){
	return elem.parentElement.id == "items" ? elem : getItem( elem.parentElement );
}

function removeChildren( id ) {
	let elem = document.getElementById( id );
	while ( elem.firstChild ) {
		elem.removeChild( elem.firstChild );
	}
}
function makeChannelSections( channels ) {
	let x = Object.keys( channels ).map( channel => channels[channel].section );
	let sections = Array.from( new Set( x ) ); // removes all duplicates
	sections.forEach( section => {
		let t = document.importNode( document.getElementById( "channelSectionTemplate" ) , true );
		t.content.querySelector( ".channelSection:first-child" ).textContent = section;
		t.content.querySelector( "div" ).id = section;
		document.querySelector( "#channels" ).appendChild( t.content );
	} );
}
function makeChannels( channels ) {
	removeChildren( "channels" );
	makeChannelSections( channels );
	for ( let channel in channels ) {
		let t = document.importNode( document.getElementById( "channelTemplate" ) , true );
		t.content.querySelector( ".title" ).textContent = channel;
		let url = new URL(channels[channel].items[0].link);
		let icon = "https://icons.duckduckgo.com/ip3/" + url.hostname + ".ico"
		t.content.querySelector( "img" ).src = icon;
		let unreadCount = channels[channel].items.filter( v => v.unread ).length;
		t.content.querySelector( ".unread" ).textContent = unreadCount > 0 ? unreadCount : "";
		t.content.firstChild.addEventListener( "click" , e => makeItems( channel ) );
		// document.querySelector( "#channels" ).appendChild( t.content );
		document.querySelector( "#" + channels[channel].section ).appendChild( t.content );
	}
}
function makeItems( channel ) {
	browser.storage.local.get( "channels" ).then( data => {
		let channels = data.channels;
		removeChildren( "items" );
		channels[channel].items.forEach( item => {
			let t = document.importNode( document.getElementById( "itemTemplate" ) , true );
			t.content.querySelector( "a" ).textContent = item.title;
			t.content.querySelector( "a" ).href = item.link;
			t.content.querySelector( "a" ).className = ( item.unread ) ? "unread" : "read";
			t.content.querySelector( ".itemChannel" ).textContent = channel;
			t.content.querySelector( ".itemDate" ).textContent = getDate( item.pubDate );
			t.content.querySelector( ".itemMarkRead" ).addEventListener( "click" , e => {
				getItem( e.target ).querySelector( "a" ).className = "read";
				browser.runtime.sendMessage( { "markAsRead" : item.title , "channel" : channel } );
			} );
			document.querySelector( "#items" ).appendChild( t.content );
		} );

	} );
}



function onStorageChanged( changes , areaName ) {
	makeChannels( changes.channels.newValue );
}

// https://www.royalroad.com/fiction/syndication/16946
// https://validator.w3.org/feed/docs/rss2.html
// http://frogs.dongs
// dongs
const addChannelPopupStatusElem = document.getElementById( "addChannelPopupStatus" );
function loadChannelStatus( errorText ) {
	let isError = errorText != "Success!";
	addChannelPopupStatusElem.style.color = isError ? "red" : "green";
	addChannelPopupStatusElem.textContent = errorText;
}
function loadNewChannel( e ) {
	let url;
	try {
		url = new URL( document.getElementById( "loadNewChannelTextInput" ).value );
	} catch ( e ) {
		return loadChannelStatus( "Field requires a valid URL" );
	}
	get( url.href ).then( data => {
		if ( data === false ) {
			return loadChannelStatus( "URL isn't an RSS or Atom page." );
		}
		loadChannelStatus( "Success!" );
		browser.runtime.sendMessage( { "url" : url.href , "channel" : data.channel , "newItems" : data.newItems } );
	} , error => loadChannelStatus( "Failed to load URL." ) );
}
function makeExport() {

}


document.getElementById( "dragBar" ).addEventListener( "mousedown" , dragBar );
document.getElementById( "loadNewChannelButton" ).addEventListener( "click" , loadNewChannel );
document.getElementById( "importFileButton" ).onclick = e => document.getElementById( "importFile" ).click(); // this is needed to use button styling for <input type="file"> tags.
browser.storage.onChanged.addListener( onStorageChanged );
window.onunload = e => browser.storage.onChanged.removeListener( onStorageChanged );
browser.storage.local.get( null ).then( v => makeChannels( v.channels ) );




