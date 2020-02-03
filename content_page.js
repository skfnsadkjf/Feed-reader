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
const getItem = elem => elem.title ? elem : getItem( elem.parentElement );
const getChannel = elem => elem.title ? elem : getChannel( elem.parentElement );

function channelUpdate( e ) {
	browser.runtime.sendMessage( { "update" : true , "title" : activeChannel } );
}
function itemMarkAsRead( e ) {
	let item = getItem( e.target );
	item.querySelector( "a" ).classList.toggle( "unread" );
	browser.runtime.sendMessage( { "markAsRead" : true , "title" : activeChannel , "item" : item.title } );
}
function channelMarkAllRead( e ) {
	browser.runtime.sendMessage( { "markAllRead" : true , "title" : activeChannel } );
}
function channelDelete( e ) {
	let title = document.querySelector( ".activeChannel" ).title;
	let confirmDelete = confirm( "Are you sure you want to completely remove feed: " + title );
	if ( confirmDelete ) {
		activeChannel = null;
		document.querySelectorAll( ".item" ).forEach( v => v.remove() );
		browser.runtime.sendMessage( { "delete" : true , "title" : title } );
	}
}
function makeItems( title ) {
	browser.runtime.sendMessage( { "getItems" : true , "title" : title } ).then( items => {
		document.querySelectorAll( ".item" ).forEach( v => v.remove() );
		items.forEach( item => {
			let t = document.importNode( document.getElementById( "itemTemplate" ) , true );
			t.content.querySelector( "a" ).textContent = item.title;
			t.content.querySelector( "a" ).href = item.link;
			t.content.querySelector( "a" ).className = ( item.unread ) ? "unread" : "read";
			t.content.querySelector( ".itemChannel" ).textContent = title;
			t.content.querySelector( ".itemDate" ).textContent = getDate( item.pubDate );
			t.content.firstChild.title = item.title; // all children must not have title attribute.
			t.content.querySelector( ".itemMarkRead" ).addEventListener( "click" , itemMarkAsRead );
			document.querySelector( "#items" ).appendChild( t.content );
		} );
	} );
}
function setActiveChannel( e ) {
	if ( activeChannel ) {
		document.querySelector( ".activeChannel" ).classList.remove( "activeChannel" );
	}
	let channel = getChannel( e.target );
	channel.classList.add( "activeChannel" );
	activeChannel = channel.title;
	makeItems( activeChannel );
}
function showCustomContextMenu( e ) {
	e.preventDefault();
	document.getElementById( "contextMenu" ).style.display = "initial";
	document.getElementById( "contextMenu" ).style.left = e.clientX + "px";
	document.getElementById( "contextMenu" ).style.top = e.clientY + "px";
	setActiveChannel( e );
}
// function makeChannelSections( channels ) {
// 	let x = Object.values( channels ).map( channel => channel.section );
// 	let sections = x.filter( ( v , i , arr ) => v && arr.indexOf( v ) == i ).sort();
// 	sections.forEach( section => {
// 		let t = document.importNode( document.getElementById( "channelSectionTemplate" ) , true );
// 		t.content.querySelector( ".channelSection:first-child" ).textContent = section;
// 		t.content.querySelector( "div" ).id = section;
// 		document.querySelector( "#channels" ).appendChild( t.content );
// 	} );
// }
function makeChannels( channels ) {
	document.querySelectorAll( ".channel" ).forEach( v => v.remove() );
	// makeChannelSections( channels );
	let channelsArray = Object.values( channels ).sort( ( a , b ) => a.title > b.title )
	channelsArray.forEach( channel => {
		let t = document.importNode( document.getElementById( "channelTemplate" ) , true );
		t.content.querySelector( ".title" ).textContent = channel.title;
		let url = new URL( channel.link );
		let icon = "https://icons.duckduckgo.com/ip3/" + url.hostname + ".ico"
		t.content.querySelector( "img" ).src = icon;
		let unreadCount = channel.items.filter( v => v.unread ).length;
		t.content.querySelector( ".title" ).style["font-weight"] = unreadCount > 0 ? "bold" : "";
		t.content.querySelector( ".unread" ).textContent = unreadCount > 0 ? unreadCount : "";
		t.content.firstChild.title = channel.title; // all children must not have title attribute.
		t.content.firstChild.addEventListener( "click" , setActiveChannel );
		t.content.firstChild.addEventListener( "contextmenu" , showCustomContextMenu );
		if ( channel.title == activeChannel )  {
			t.content.firstChild.classList.add( "activeChannel" );
		}
		let section = document.querySelector( "#" + channel.section );
		let parent = section != null ? section : document.getElementById( "noSection" );
		parent.appendChild( t.content );
	} );
}



function onStorageChanged( changes , areaName ) {
	// makeChannels( changes.channels.newValue );
	browser.runtime.sendMessage( { "getChannels" : true } ).then( v => makeChannels( v ) );
}

// https://www.royalroad.com/fiction/syndication/16946
// https://www.youtube.com/feeds/videos.xml?channel_id=UCrTNhL_yO3tPTdQ5XgmmWjA
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
	let url = document.getElementById( "loadNewChannelTextInput" ).value;
	if ( !url.match( /.:/ ) ) { // Valid URLs only require a single colon proceeded by at least 1 character.
		return loadChannelStatus( "Field requires a URL" );
	}
	console.log( url );
	browser.runtime.sendMessage( { "newChannelURL" : url } ).then( error => {
		loadChannelStatus( error ? "Failed to load URL." : "Success!" );
	} );
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
			return { "href" : v.getAttribute( "xmlUrl" ) , "title" : v.getAttribute( "title" ) };
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
		for ( let title in channels ) {
			let outline = xmlDoc.createElement( "outline" );
			outline.setAttribute( "text" , title );
			outline.setAttribute( "title" , title );
			outline.setAttribute( "type" , "rss" );
			outline.setAttribute( "xmlUrl" , channels[title].link );
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
let activeChannel = null;
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

