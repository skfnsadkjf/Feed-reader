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
	return date.toLocaleString( "en-US" , dateOptions ) + " (" + num + " " + word + " ago)";
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
const getChannel = elem => elem.title ? elem : getChannel( elem.parentElement );

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
function setActiveChannel( elem ) {
	const activeChannel = document.querySelector( ".activeChannel" );
	if ( activeChannel ) {
		activeChannel.classList.remove( "activeChannel" );
	}
	elem.classList.add( "activeChannel" );
}
function channelUpdate( e ) {
	let channel = document.querySelector( ".activeChannel" ).title;
	browser.runtime.sendMessage( { "update" : channel } );
}
function channelMarkAllRead( e ) {
	let channel = document.querySelector( ".activeChannel" ).title;
	browser.runtime.sendMessage( { "markAllRead" : channel } );
}
function channelDelete( e ) {
	let channel = document.querySelector( ".activeChannel" ).title;
	let confirmDelete = confirm( "Are you sure you want to completely remove feed: " + channel );
	if ( confirmDelete ) {
		browser.runtime.sendMessage( { "delete" : channel } );
	}
}
function channelClick( e ) {
	let channel = getChannel( e.target );
	setActiveChannel( getChannel( e.target ) );
	makeItems( channel.title );
}
function showCustomContextMenu( e ) {
	e.preventDefault();
	channelClick( e );
	document.getElementById( "contextMenu" ).style.display = "initial";
	document.getElementById( "contextMenu" ).style.left = e.clientX + "px";
	document.getElementById( "contextMenu" ).style.top = e.clientY + "px";
}
function makeChannels( channels ) {
	removeChildren( "channels" );
	makeChannelSections( channels );
	for ( let channel in channels ) {
		let t = document.importNode( document.getElementById( "channelTemplate" ) , true );
		t.content.querySelector( ".title" ).textContent = channel;
		let url = new URL(channels[channel].link);
		let icon = "https://icons.duckduckgo.com/ip3/" + url.hostname + ".ico"
		t.content.querySelector( "img" ).src = icon;
		let unreadCount = channels[channel].items.filter( v => v.unread ).length;
		t.content.querySelector( ".unread" ).textContent = unreadCount > 0 ? unreadCount : "";
		t.content.firstChild.title = channel; // all children must not have title attribute.
		t.content.firstChild.addEventListener( "click" , channelClick );
		t.content.firstChild.addEventListener( "contextmenu" , showCustomContextMenu );
		// document.querySelector( "#channels" ).appendChild( t.content );
		document.querySelector( "#" + channels[channel].section ).appendChild( t.content );
	}
}
function makeItems( channel ) {
	browser.runtime.sendMessage( { "getItems" : channel } ).then( items => {
		removeChildren( "items" );
		items.forEach( item => {
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
function loadChannelStatus( errorText ) {
	let addChannelPopupStatusElem = document.getElementById( "addChannelPopupStatus" );
	let isError = errorText != "Success!";
	addChannelPopupStatusElem.style.color = isError ? "red" : "green";
	addChannelPopupStatusElem.textContent = errorText;
}
function loadNewChannel( e ) {
	e.preventDefault();
	let url;
	try {
		url = new URL( document.getElementById( "loadNewChannelTextInput" ).value );
	} catch ( err ) {
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

const opmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
<head>
<title>Feed Subscriptions</title>
</head>
<body>
</body>
</opml>`
function opmlImport( e ) {
	let file = e.target.files[0];
	file.text().then( async text => {
		let parser = new DOMParser();
		let xmlDoc = parser.parseFromString( text , "text/xml" );
		let outlines = xmlDoc.querySelectorAll( "outline[xmlUrl]" );
		let channels = Array.from( outlines , v => {
			return { "href" : v.getAttribute( "xmlUrl" ) , "channel" : v.getAttribute( "title" ) };
		} );
		browser.runtime.sendMessage( { "opmlImport" : channels } );
	} );
}
function jsonImport( e ) {
	let file = e.target.files[0];
	file.text().then( json => {
		let channels = JSON.parse( json );
		browser.runtime.sendMessage( { "jsonImport" : channels } );
	} );
}
function opmlExport() {
	browser.runtime.sendMessage( { "getChannels" : true } ).then( channels => {
		let parser = new DOMParser();
		let xmlDoc = parser.parseFromString( opmlTemplate , "text/xml" );
		let xmlBody = xmlDoc.querySelector( "body" );
		for ( let channel in channels ) {
			let outline = xmlDoc.createElement( "outline" );
			outline.setAttribute( "text" , channel );
			outline.setAttribute( "title" , channel );
			outline.setAttribute( "type" , "rss" );
			outline.setAttribute( "xmlUrl" , channels[channel].link );
			xmlBody.appendChild( outline );
			xmlBody.appendChild( xmlDoc.createTextNode( "\n" ) );
		}
		let serializer = new XMLSerializer();
		let xmlString = serializer.serializeToString( xmlDoc );
		console.log( xmlString );
		let blob = new Blob( [xmlString] , { "type" : "text/xml" } );
		let a = document.getElementById( "opmlExportFile" );
		a.href = URL.createObjectURL( blob );
		a.click();
		URL.revokeObjectURL( a.href );
	} );
}
function jsonExport() {
	browser.runtime.sendMessage( { "getChannels" : true } ).then( channels => {
		let json = JSON.stringify( channels );
		let blob = new Blob( [json] , { "type" : "application/json" } );
		let a = document.getElementById( "jsonExportFile" );
		a.href = URL.createObjectURL( blob );
		a.click();
		URL.revokeObjectURL( a.href );
	} );
}
const hideCustomContextMenu = e => document.getElementById( "contextMenu" ).style.display = "none";
const updateAllFeeds = e => browser.runtime.sendMessage( { "updateAll" : true } );
const jsonImportButton = e => document.getElementById( "jsonImportFile" ).click();
const opmlImportButton = e => document.getElementById( "opmlImportFile" ).click();
window.addEventListener( "blur" , hideCustomContextMenu );
window.addEventListener( "click" , hideCustomContextMenu );
window.addEventListener( "keydown" , hideCustomContextMenu );
document.getElementById( "dragBar" ).addEventListener( "mousedown" , dragBar );
document.getElementById( "loadNewChannel" ).addEventListener( "submit" , loadNewChannel );
document.getElementById( "updateAll" ).addEventListener( "click" , updateAllFeeds );
document.getElementById( "jsonImportFileButton" ).addEventListener( "click" , jsonImportButton );
document.getElementById( "opmlImportFileButton" ).addEventListener( "click" , opmlImportButton );
document.getElementById( "jsonImportFile" ).addEventListener( "change" , jsonImport );
document.getElementById( "opmlImportFile" ).addEventListener( "change" , opmlImport );
document.getElementById( "jsonExportFileButton" ).addEventListener( "click" , jsonExport );
document.getElementById( "opmlExportFileButton" ).addEventListener( "click" , opmlExport );
document.getElementById( "contextMenuUpdate" ).addEventListener( "click" , channelUpdate );
document.getElementById( "contextMenuMarkAllRead" ).addEventListener( "click" , channelMarkAllRead );
document.getElementById( "contextMenuDelete" ).addEventListener( "click" , channelDelete );
browser.storage.onChanged.addListener( onStorageChanged );
window.onunload = e => browser.storage.onChanged.removeListener( onStorageChanged );
browser.runtime.sendMessage( { "getChannels" : true } ).then( v => makeChannels( v ) );

