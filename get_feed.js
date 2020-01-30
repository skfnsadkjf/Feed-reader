export { get , parseXML };


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
