/*
 * EXAMPLES
 * 
 * EP:
 * https://music.apple.com/us/album/shaman-ep/1569513168
 * 
 * Features: 
 * https://music.apple.com/us/album/to-pimp-a-butterfly/1440828886
 * 
 * Foreign Characters:
 * https://music.apple.com/us/album/pedro-alt%C3%A9rio-bruno-piazza/577195766
 * 
 * Two Disc:
 * https://music.apple.com/us/album/pet-sounds-50th-anniversary-deluxe-edition-2016-remaster/1440850596
 * 
 * Various Artists:
 * https://music.apple.com/us/album/cyberpunk-2077-more-music-from-night-city-radio-original/1558984869
 * 
 * Live album
 * https://music.apple.com/us/album/united-we-stand-live/1827097035
 * 
 */

function parseHTML() {
    var url = document.getElementById('url').value;

    $.getJSON('https://api.allorigins.win/get?url=' + encodeURIComponent(url), function (data){
        var parser = new DOMParser();
        var doc = parser.parseFromString(data.contents, "text/html");
        parseDataFromSource(doc);
    }).fail(function() {
        document.getElementById('parseURLButton').disabled = true;
        alert("API unreachable. Please save and upload the page's HTML file manually.");
        document.getElementById('fileInputSection').style.display = 'block';
    });

}

// ChatGPT assisted rewrite using the iTunes Search API
function parseDataFromItunesApi() {
    const input = document.getElementById('url').value.trim();

    let url;
    try {
        url = new URL(input);
    } catch {
        alert('Please enter a valid Apple Music URL.');
        return;
    }

    const match = url.pathname.match(
        /^\/([a-z]{2})\/album\/(?:[^/]+\/)?(\d+)\/?$/i
    );

    if (url.hostname !== 'music.apple.com' || !match) {
        alert('Please enter a valid Apple Music album URL.');
        return;
    }

    const country = match[1].toLowerCase();
    const albumId = match[2];

    console.log('Album ID:', albumId);
    console.log('Storefront:', country);


    const apiUrl = new URL('https://itunes.apple.com/lookup');
    apiUrl.searchParams.set('id', albumId);
    apiUrl.searchParams.set('country', country);
    apiUrl.searchParams.set('entity', 'song');
    apiUrl.searchParams.set('limit', '200');

    $.ajax({
        url: apiUrl.toString(),
        dataType: 'jsonp',
        timeout: 15000
    }).done(function(data) {
        const album = data.results.find(item =>
            item.wrapperType === 'collection' &&
            String(item.collectionId) === albumId
        );

        const tracks = data.results
            .filter(item =>
                item.wrapperType === 'track' &&
                item.kind === 'song' &&
                String(item.collectionId) === albumId
            )
            .sort((a, b) =>
                (a.discNumber - b.discNumber) ||
                (a.trackNumber - b.trackNumber)
            );
        
        if (!album) {
            console.error('Album metadata not found.');
            return;
        }


        if (tracks.length === 0) {
            alert(
                "The iTunes API could not retrieve the tracklist for this album. " +
                "Please save the Apple Music page as an HTML file and upload it manually."
            );

            document.getElementById('fileInputSection').style.display = 'block';
            document.getElementById('textOutput').textContent = '';
            document.getElementById('outputContainer').style.display = 'none';
            return;
        }


        const albumData = {
            artistName: album.artistName || '',
            albumTitle: album.collectionName || '',
            releaseDate: album.releaseDate
                ? formatDateToLongForm(album.releaseDate)
                : '',
            genres: album.primaryGenreName
                ? [album.primaryGenreName]
                : [],
            copyright: album.copyright || '',
            artworkUrl: (album.artworkUrl100 || '')
                .replace(/\d+x\d+bb(?=\.)/i, '9999x9999bb'),
            trackCount: tracks.length
        };

        const rawTitle = albumData.albumTitle;

        if (/\s*-\s*EP$/i.test(rawTitle)) {
            albumData.albumType = 'EP';
            albumData.albumTitle = rawTitle.replace(/\s*-\s*EP$/i, '').trim();
        } else if (/\s*(?:\(Live\)|\[Live\])/i.test(rawTitle)) {
            albumData.albumType = 'Live Album';
            albumData.albumTitle = rawTitle.replace(/\s*(?:\(Live\)|\[Live\])/i, '').trim();
        } else {
            albumData.albumType = 'Album';
        }

        console.log('Normalized album data:', albumData);

        const trackData = tracks.map(track => ({
            trackNumber: track.trackNumber,
            discNumber: track.discNumber,
            title: track.trackName || '',
            artistName: track.artistName || '',
            duration: typeof track.trackTimeMillis === 'number'
                ? `${Math.floor(track.trackTimeMillis / 60000)}:${String(
                    Math.floor((track.trackTimeMillis % 60000) / 1000)
                ).padStart(2, '0')}`
                : ''
        }));

        // console.log('Normalized track data:', trackData);


        const featureCandidates = trackData.filter(track =>
            /[\[(](?:feat\.?|ft\.?|featuring)\s/i.test(track.title) ||
            (
                albumData.artistName !== 'Various Artists' &&
                track.artistName !== albumData.artistName
            )
        );

        console.table(featureCandidates);


        const trackFeatures = new Map();
        const multiDisc = trackData.some(track => track.discNumber > 1);

        for (const track of trackData) {
            const match = track.title.match(
                /\s*[\[(](?:feat\.?|ft\.?|featuring)\s+([^\]\)]+)[\]\)]/i
            );

            if (!match) continue;

            const artists = match[1].split(/\s*,\s*|\s+&\s+/);
            const trackRef = multiDisc
                ? `${track.discNumber}.${track.trackNumber}`
                : String(track.trackNumber);

            for (const artist of artists) {
                const name = artist.trim();
                if (!name) continue;

                if (!trackFeatures.has(name)) {
                    trackFeatures.set(name, []);
                }

                trackFeatures.get(name).push(trackRef);
            }

            track.title = track.title.replace(match[0], '').trim();
        }


        if (albumData.artistName !== 'Various Artists') {
            const primaryArtist = albumData.artistName.trim();

            for (const track of trackData) {
                let credits = track.artistName.trim();

                if (!credits || credits === primaryArtist) continue;

                // Remove the primary album artist from combined credits
                for (const separator of [' & ', ', ']) {
                    if (credits.startsWith(primaryArtist + separator)) {
                        credits = credits.slice((primaryArtist + separator).length);
                        break;
                    }
                    if (credits.endsWith(separator + primaryArtist)) {
                        credits = credits.slice(0, -(separator + primaryArtist).length);
                        break;
                    }
                }

                const artists = credits.split(/\s+&\s+|,\s*/);
                const trackRef = multiDisc
                    ? `${track.discNumber}.${track.trackNumber}`
                    : String(track.trackNumber);

                for (const artist of artists) {
                    const name = artist.trim();
                    if (!name || name === primaryArtist) continue;

                    if (!trackFeatures.has(name)) {
                        trackFeatures.set(name, []);
                    }

                    const trackNumbers = trackFeatures.get(name);

                    // Prevent duplicate credits from titles and artist metadata
                    if (!trackNumbers.includes(trackRef)) {
                        trackNumbers.push(trackRef);
                    }
                }
            }
        }

        const albumArtists = new Set(
            albumData.artistName
                .split(/\s+&\s+|,\s*/)
                .map(name => name.trim().toLocaleLowerCase())
                .filter(Boolean)
        );

        for (const artist of trackFeatures.keys()) {
            if (albumArtists.has(artist.trim().toLocaleLowerCase())) {
                trackFeatures.delete(artist);
            }
        }

        console.table(
            Array.from(trackFeatures, ([artist, tracks]) => ({
                artist,
                tracks: tracks.join(',')
            }))
        );


        const isVariousArtists = albumData.artistName === 'Various Artists';


        albumData.albumTitle = albumData.albumTitle
            .replace(/\s*(?:\(Live\)|\[Live\])/gi, '')
            .trim();

        for (const track of trackData) {
            track.title = track.title
                .replace(/\s*(?:\(Live\)|\[Live\])/gi, '')
                .trim();
        }


        const outputLines = [
            albumData.artistName,
            albumData.albumTitle,
            albumData.releaseDate,
            '',
            `Type: ${albumData.albumType}`,
            `Genres: ${albumData.genres.join(', ')}`,
            ''
        ];

        // TRACKLIST
        for (const track of trackData) {
            const number = multiDisc
                ? `${track.discNumber}.${track.trackNumber}`
                : String(track.trackNumber);

            const artist = isVariousArtists
                ? `${track.artistName} - `
                : '';

            outputLines.push(
                `${number}|${artist}${track.title}|${track.duration}`
            );
        }

        // FEATURED ARTISTS
        if (trackFeatures.size > 0) {
            outputLines.push('', 'Track Features');

            const maxLength = Math.max(
                ...Array.from(trackFeatures.keys(), name => name.length)
            );

            for (const [artist, numbers] of trackFeatures) {
                const padding = ' '.repeat(maxLength - artist.length + 1);
                outputLines.push(
                    `${artist}: ${padding}${numbers.join(',')}`
                );
            }
        }

        // COPYRIGHT
        outputLines.push('', albumData.copyright, '');

        const sonemicOutput = outputLines.join('\n');

        console.log(sonemicOutput);
        document.getElementById('textOutput').textContent = sonemicOutput;
        document.getElementById('outputContainer').style.display = 'block';


        const oldCoverAnchor = document.getElementById('coverAnchor');
        if (oldCoverAnchor) {
            oldCoverAnchor.remove();
        }

        if (albumData.artworkUrl) {
            const coverAnchor = document.createElement('a');
            coverAnchor.id = 'coverAnchor';
            coverAnchor.href = albumData.artworkUrl;
            coverAnchor.download = `${albumData.albumTitle}.jpg`;
            coverAnchor.target = '_blank';
            coverAnchor.rel = 'noopener noreferrer';

            coverAnchor.addEventListener('click', async function(event) {
                event.preventDefault();

                try {
                    const response = await fetch(albumData.artworkUrl);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);

                    const downloadLink = document.createElement('a');
                    downloadLink.href = blobUrl;
                    downloadLink.download =
                        `${albumData.artistName} - ${albumData.albumTitle}.jpg`
                            .replace(/[\\/:*?"<>|]/g, '_');

                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    downloadLink.remove();

                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

                } catch (error) {
                    console.error('Artwork download failed:', error);
                    alert('Unable to download album artwork.');
                }
            });

            const coverImg = document.createElement('img');
            coverImg.id = 'coverImg';
            coverImg.src = albumData.artworkUrl;
            coverImg.alt = `${albumData.albumTitle} artwork`;

            coverImg.onload = function() {
                this.style.width = this.naturalWidth < 1000
                    ? `${this.naturalWidth}px`
                    : '100%';
                this.style.maxWidth = '100%';
                this.style.height = 'auto';
            };

            coverAnchor.appendChild(coverImg);


            // Remove the hyperlink so the browser doesn't preview the Apple URL
            coverAnchor.removeAttribute('href');
            coverAnchor.removeAttribute('target');
            coverAnchor.removeAttribute('download');

            // Make the artwork act like a download button
            coverAnchor.setAttribute('role', 'button');
            coverAnchor.tabIndex = 0;
            coverAnchor.title = 'Click to download full-resolution album artwork';

            coverAnchor.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 12px;
                box-sizing: border-box;
                border: 1px solid #888;
                border-radius: 10px;
                cursor: pointer;
                text-decoration: none;
                text-align: center;
            `;

            const downloadHint = document.createElement('span');
            downloadHint.textContent = '↓ Click to download full-resolution artwork';
            downloadHint.style.cssText = `
                font-size: 0.9em;
                color: inherit;
            `;

            coverAnchor.insertBefore(downloadHint, coverImg);

            coverAnchor.appendChild(downloadHint);

            // Keyboard accessibility
            coverAnchor.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    coverAnchor.click();
                }
            });

            coverAnchor.prepend(downloadHint);
            document.getElementById('outputContainer').appendChild(coverAnchor);
        }



    }).fail(function(jqXHR, status, error) {
        console.error('iTunes API request failed:', status, error);
    });


    return { albumId, country };
}


function parseHtmlFile() {
    const fileInput = document.getElementById('htmlFile');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select an HTML file first.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
        const htmlContent = event.target.result;

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");

        parseDataFromSource(doc);
    };

    reader.onerror = function() {
        alert("Error reading HTML file.");
    };

    reader.readAsText(file);
};

function parseDataFromSource(doc) {
    var artistName = '';
    var albumTitle = '';
    var releaseDate = '';
    var genreList = '';
    var discCount = 1;

    var albumType = 'Album';
    var output = '';

    // contains everything except disc numbers and VA release artist lists
    
    var schemaElement = doc.getElementById("schema:music-album");
    var schemaJson;

    if (schemaElement) {
        // Preserve support for older Apple Music HTML
        schemaJson = JSON.parse(schemaElement.textContent.trim());
    } else {
        // Read metadata directly from newer Apple Music HTML
        const titleElement = doc.querySelector('.headings__title > span');
        const artistElement = doc.querySelector('.headings__subtitles');
        const genreElement = doc.querySelector('.headings__metadata-bottom');
        const footerElement = doc.querySelector('.footer-body > p');

        if (!titleElement || !artistElement || !footerElement) {
            alert('Unable to locate album metadata in the uploaded HTML.');
            return;
        }

        const artist = artistElement.textContent.trim();
        const genre = genreElement?.textContent.split('·')[0].trim() || '';

        schemaJson = {
            name: titleElement.textContent.trim(),
            byArtist: artist === 'Various Artists'
                ? []
                : [{ name: artist }],
            datePublished: footerElement.textContent.split(/\r?\n/)[0].trim(),
            genre: genre ? [genre] : [],
            image: ''
        };
    }


    // ARTIST NAME(S)
    var artistCount = schemaJson.byArtist.length;
    var vaRelease = artistCount == 0 ? true : false;
    if (artistCount < 2) {
        artistName = vaRelease ? 'Various Artists' : schemaJson.byArtist[0].name;
    } else {
        for (i = 0; i < artistCount; i++) {
            if (i > 0) {
                artistName = (i == artistCount - 1) ? artistName + ' & ' : artistName + ', ';
            }
            artistName = artistName + schemaJson.byArtist[i].name;
        }
    }

    // ALBUM TITLE
    var albumTitleText = schemaJson.name;
    if ((new RegExp('- EP$')).test(albumTitleText.toUpperCase())) {
        albumType = 'EP';
        albumTitle = albumTitleText.replace(/- EP/, '').replace(/- Ep/, '').replace(/- ep/, '').trim();
    } else if (albumTitleText.includes('(Live)') || albumTitleText.includes('[Live]')) {
        albumType = 'Live Album';
        albumTitle = albumTitleText.replace('(Live)', '').replace('[Live]', '').trim();
    } else {
        albumTitle = albumTitleText;
    }

    // RELEASE DATE
    releaseDate = formatDateToLongForm(schemaJson.datePublished);

    // GENRES
    for(i = 0; i < schemaJson.genre.length; i++){
        if(i>0){
            genreList = genreList + ', ';
        }
        genreList = genreList + schemaJson.genre[i];
    }

    
    // COVER ART URL
    var coverArtThumbUrl = schemaJson.image || '';
    var coverArtUrl = coverArtThumbUrl.replace(
        /\d+x\d+bb(?=\.)/i,
        '9999x9999bb'
    );

    // If the saved HTML has no original artwork URL,
    // retrieve it using the album ID preserved in its links.
    if (!coverArtUrl) {
        const albumLink = doc.querySelector(
            'a[data-testid^="other-language-"][href*="/album/"]'
        )?.getAttribute('href');

        const match = albumLink?.match(
            /music\.apple\.com\/([a-z]{2})\/album\/[^/?#]+\/(\d+)/i
        );

        if (match) {
            const country = match[1];
            const albumId = match[2];

            $.ajax({
                url: 'https://itunes.apple.com/lookup',
                data: {
                    id: albumId,
                    country: country,
                    entity: 'song'
                },
                dataType: 'jsonp',
                timeout: 15000
            }).done(function(data) {
                const album = data.results?.find(item =>
                    item.wrapperType === 'collection' &&
                    String(item.collectionId) === albumId
                );

                if (album?.artworkUrl100) {
                    coverArtUrl = album.artworkUrl100.replace(
                        /\d+x\d+bb(?=\.)/i,
                        '9999x9999bb'
                    );

                    coverImg.src = coverArtUrl;
                    coverAnchor.href = coverArtUrl;
                }
            }).fail(function() {
                console.warn('Album artwork lookup failed.');
            });
        }
    }


    // TRACK STUFF FROM HTML DEPENDING ON URL OR HARD FILE
    var discCount = 1;
    var serialized = true;

    var tracksJson = new Array();
    var trackNumElems = new Array();
    var trackTitleElems = new Array();
    var trackArtistElems = new Array();
    var trackDurationElems = new Array();

    var serializedServerJsonElem = doc.getElementById("serialized-server-data");
    if(serializedServerJsonElem != null){
        var serializedServerJsonString = serializedServerJsonElem.textContent.trim();
        var serializedServerJson = JSON.parse(serializedServerJsonString);
        var sections = serializedServerJson[0].data.sections;
        for (i = 0; i < sections.length; i++) {
            if (sections[i].id.includes('track-list -')) {
                tracksJson = tracksJson.concat(sections[i].items);
            }
        }
    } else {
        serialized = false;
        trackNumElems = doc.getElementsByClassName("songs-list-row__column-data");
        trackTitleElems = doc.getElementsByClassName("songs-list-row__song-name");
        trackArtistElems = doc.getElementsByClassName("songs-list-row__by-line");
        trackDurationElems = doc.getElementsByClassName("songs-list-row__length");
    }

    var trackCount = serialized ? tracksJson.length : trackTitleElems.length;

    var trackNumbers = new Array(trackCount);
    var discNumbers = new Array(trackCount);

    var trackNames = new Array(trackCount);
    var trackFeats = new Map();

    var trackArtistStrings = new Array(trackCount);
    var trackDurations = new Array(trackCount);

    var prevTrackNumber = 1;
    var featurePadBase = 0;
    for (i = 0; i < trackCount; i++) {
        trackNumbers[i] = serialized ? tracksJson[i].trackNumber : trackNumElems[i].textContent.trim();

        if(parseInt(trackNumbers[i], 10) < prevTrackNumber){
            discCount++;
        }
        discNumbers[i] = discCount;
        prevTrackNumber = parseInt(trackNumbers[i], 10);

        var trackArtistNames = '';
        if(vaRelease){
            if(serialized){
                trackArtistNames = tracksJson[i].artistName;
            } else {
                trackArtistSpan = trackArtistElems[i].children[0];
                for (j = 0; j < trackArtistSpan.children.length; j++) {
                    if (j > 0) {
                        trackArtistNames = (i == trackArtistSpan.children.length - 1) ? trackArtistNames + ' & ' : trackArtistNames + ', ';
                    }
                    trackArtistNames = trackArtistNames + trackArtistSpan.children[j].textContent.trim();
                }
            }
            trackArtistStrings[i] = trackArtistNames;
        } else {
            trackArtistNames = artistName;
        }

        var trackName = serialized ? tracksJson[i].title : trackTitleElems[i].textContent.trim();
        if (trackName.includes('(feat.') || trackName.includes('[feat.') ||
            trackName.includes('(Feat.') || trackName.includes('[Feat.') ||
            (!vaRelease && artistName !== trackArtistNames)) {
            var features = '';
            if (trackName.includes('(feat.')) {
                features = trackName.substring(trackName.indexOf('(feat.') + 6, trackName.indexOf(')'));
            } else if (trackName.includes('[feat.')) {
                features = trackName.substring(trackName.indexOf('[feat.') + 6, trackName.indexOf(']'));
            } else if (trackName.includes('(Feat.')) {
                features = trackName.substring(trackName.indexOf('(Feat.') + 6, trackName.indexOf(')'));
            } else if (trackName.includes('[Feat.')) {
                features = trackName.substring(trackName.indexOf('[Feat.') + 6, trackName.indexOf(']'));
            } else {
                features = trackArtistNames.replace(artistName + ',', '').replace(artistName + ' &', '').replace(artistName, '').trim();
            }

            var discPrefix = ((discCount == 1) ? '' : discNumbers[i] + '.');
            var splitFeats = features.split(',');
            for (j = 0; j < splitFeats.length; j++) {
                if (splitFeats[j].includes('&')) {
                    var splitFeats2 = splitFeats[j].split('&');

                    var featTrackNums = trackFeats.get(splitFeats2[0].trim());
                    featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                    trackFeats.set(splitFeats2[0].trim(), featTrackNums);
                    featurePadBase = splitFeats2[0].trim().length > featurePadBase ? splitFeats2[0].trim().length : featurePadBase;

                    featTrackNums = trackFeats.get(splitFeats2[1].trim());
                    featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                    trackFeats.set(splitFeats2[1].trim(), featTrackNums);
                    featurePadBase = splitFeats2[1].trim().length > featurePadBase ? splitFeats2[1].trim().length : featurePadBase;
                } else {
                    var featTrackNums = trackFeats.get(splitFeats[j].trim());
                    featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                    trackFeats.set(splitFeats[j].trim(), featTrackNums);
                    featurePadBase = splitFeats[j].trim().length > featurePadBase ? splitFeats[j].trim().length : featurePadBase;
                }
            }
            if (trackName.includes('(feat.')) {
                trackName = trackName.substring(0, trackName.indexOf('(feat.')).trim();
            } else if (trackName.includes('[feat.')) {
                trackName = trackName.substring(0, trackName.indexOf('[feat.')).trim();
            }
        }
        if (albumType.includes('Live')) {
            trackName = trackName.replace('(Live)', '').replace('[Live]', '').trim();
        }
        trackNames[i] = trackName;

        if(serialized){
            trackDurations[i] = tracksJson[i].duration === undefined ? "" : new Date(tracksJson[i].duration).toISOString().slice(14, 19).replace(/^0+/, '');
        } else {
            trackDurations[i] = trackDurationElems[i].textContent.trim();
        }
    }
    featurePadBase++;

    // RUNTIME & COPYRIGHT
    var releaseDateCopyrightDiv = doc.querySelector('.footer-body');
    var releaseDateCopyrightP = releaseDateCopyrightDiv.children[0];
    var releaseDateCopyright = releaseDateCopyrightP.textContent.split(/\r?\n/);
    var copyright = '';
    for (i = 0; i < releaseDateCopyright.length; i++) {
        if (i > 1) {
            copyright = copyright + releaseDateCopyright[i].trim().toProperCase().replace('Llc', 'LLC') + '\n';
        }

    }

    // text output
    output = output + artistName + '\n';
    output = output + albumTitle + '\n';
    output = output + releaseDate + '\n\nType: ';
    output = output + albumType + '\nGenres: ';
    output = output + genreList + '\n\n';

    for (i = 0; i < trackNames.length; i++) {
        output = output + ((discCount == 1) ? '' : discNumbers[i] + '.');
        output = output + trackNumbers[i] + '|';
        if (vaRelease) {
            output = output + trackArtistStrings[i] + ' - ';
        }
        output = output + trackNames[i] + '|' + trackDurations[i] + '\n';
    }
    if (trackFeats.size > 0) {
        output = output + '\nTrack Features\n';
        for (let [artist, trackNums] of trackFeats) {
            var padding = '';
            for (i = 0; i < featurePadBase - artist.length; i++) {
                padding = padding + ' ';
            }
            output = output + artist + ': ' + padding + trackNums + '\n';
        }
    }
    output = output + '\n' + copyright + '\n';

    var codeTag = document.getElementById('textOutput');
    codeTag.innerHTML = output;

    // clear old cover art
    var oldCoverAnchor = document.getElementById('coverAnchor');
    if(oldCoverAnchor != null){
        oldCoverAnchor.parentNode.removeChild(oldCoverAnchor);
    }
    
    
    // GENERATE ARTWORK DOWNLOAD CARD
    const coverAnchor = document.createElement('a');
    coverAnchor.id = 'coverAnchor';
    coverAnchor.setAttribute('role', 'button');
    coverAnchor.tabIndex = 0;
    coverAnchor.title = 'Click to download full-resolution album artwork';

    coverAnchor.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 12px;
        box-sizing: border-box;
        border: 1px solid #888;
        border-radius: 10px;
        cursor: pointer;
        text-decoration: none;
        text-align: center;
    `;

    // DOWNLOAD INSTRUCTION ABOVE ARTWORK
    const downloadHint = document.createElement('span');
    downloadHint.textContent = '↓ Click to download full-resolution artwork';
    downloadHint.style.cssText = `
        font-size: 0.9em;
        color: inherit;
    `;

    coverAnchor.appendChild(downloadHint);

    // ARTWORK IMAGE
    const coverImg = document.createElement('img');
    coverImg.id = 'coverImg';
    coverImg.alt = `${albumTitle} artwork`;

    coverImg.onload = function() {
        this.style.width = this.naturalWidth < 1000
            ? `${this.naturalWidth}px`
            : '100%';
        this.style.maxWidth = '100%';
        this.style.height = 'auto';
    };

    if (coverArtUrl) {
        coverImg.src = coverArtUrl;
    }

    coverAnchor.appendChild(coverImg);

    // CLICK TO DOWNLOAD
    coverAnchor.addEventListener('click', async function() {
        if (!coverArtUrl) {
            alert('Album artwork is unavailable.');
            return;
        }

        try {
            const response = await fetch(coverArtUrl);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download =
                `${artistName} - ${albumTitle}.jpg`
                    .replace(/[\\/:*?"<>|]/g, '_');

            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();

            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

        } catch (error) {
            console.error('Artwork download failed:', error);
            alert('Unable to download album artwork.');
        }
    });

    // KEYBOARD ACCESSIBILITY
    coverAnchor.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            coverAnchor.click();
        }
    });

    // REVEAL OUTPUT
    const sectionTag = document.getElementById('outputContainer');
    sectionTag.appendChild(coverAnchor);
    sectionTag.style.display = 'block';
}

//deprecated
function parseJSON(doc) {
    // cleanup cover art elements from previous runs
    var oldCoverArtAnchor = document.getElementById('coverAnchor');
    if (oldCoverArtAnchor != null) {
        oldCoverArtAnchor.remove();
    }

    var albumType = 'Album';
    var output = '';

    // artist name
    var artistNameDiv = doc.querySelector('.headings__subtitles');
    var vaRelease = (artistNameDiv.textContent.includes('Various Artists')) ? true : false;
    var artistCount = artistNameDiv.children.length;
    var artistName = "";
    if (artistCount < 2) {
        artistName = vaRelease ? 'Various Artists' : artistNameDiv.children[0].textContent.trim();
    } else {
        for (i = 0; i < artistCount; i++) {
            if (i > 0) {
                artistName = (i == artistCount - 1) ? artistName + ' & ' : artistName + ', ';
            }
            artistName = artistName + artistNameDiv.children[i].textContent.trim();
        }
    }

    // album title
    var albumTitle = '';
    var albumTitleH1 = doc.querySelector('.headings__title');
    var albumTitleText = albumTitleH1.textContent.replace('<!---->', '').trim();
    if ((new RegExp('- EP$')).test(albumTitleText.toUpperCase())) {
        albumType = 'EP';
        albumTitle = albumTitleText.replace(/- EP/, '').replace(/- Ep/, '').replace(/- ep/, '').trim();
    } else if (albumTitleText.includes('(Live)') || albumTitleText.includes('[Live]')) {
        albumType = 'Live Album';
        albumTitle = albumTitleText.replace('(Live)', '').replace('[Live]', '').trim();
    } else {
        albumTitle = albumTitleText;
    }

    // release date
    var releaseDateCopyrightDiv = doc.querySelector('.footer-body');
    var releaseDateCopyrightP = releaseDateCopyrightDiv.children[0];
    var releaseDateCopyright = releaseDateCopyrightP.textContent.split(/\r?\n/);
    var releaseDate = releaseDateCopyright[0].replace('<!---->', '').trim().toProperCase();
    var copyright = '';
    for (i = 0; i < releaseDateCopyright.length; i++) {
        if (i > 1) {
            copyright = copyright + releaseDateCopyright[i].trim().toProperCase().replace('Llc', 'LLC') + '\n';
        }

    }

    // cover art img
    var coverArtDiv = doc.querySelector('.artwork__radiosity');
    var srcset = coverArtDiv.children[0].children[0].children[0].srcset;
    var firstsize = srcset.match(/\d\d\dw/);
    var coverArtThumbUrl = srcset.substring(0, srcset.indexOf(firstsize)).trim();
    var coverArtUrl = coverArtThumbUrl.replace(/\d\d\dx\d\d\d/, '9999x9999').replace('webp', 'jpg');

    // TRACK STUFF FROM JSON
    var discCount = 1;

    var serializedServerJsonString = doc.getElementById("serialized-server-data").textContent.trim();
    var serializedServerJson = JSON.parse(serializedServerJsonString);
    var sections = serializedServerJson[0].data.sections;
    var tracks = new Array();
    for (i = 0; i < sections.length; i++) {
        if (sections[i].id.includes('track-list -')) {
            tracks = tracks.concat(sections[i].items);
        }
    }
    var trackCount = tracks.length;

    var trackNumbers = new Array(trackCount);
    var discNumbers = new Array(trackCount);
    var prevDiscNumber = 1;

    var trackNames = new Array(trackCount);
    var trackFeats = new Map();

    var trackArtistStrings = new Array(trackCount);
    var trackDurations = new Array(trackCount);

    var featurePadBase = 0;
    for (i = 0; i < trackCount; i++) {
        trackNumbers[i] = tracks[i].trackNumber;
        discNumbers[i] = tracks[i].discNumber;

        if (discNumbers[i] > prevDiscNumber) {
            discCount++;
        }
        prevDiscNumber = discNumbers[i];

        var trackArtistNames = tracks[i].artistName;
        if (vaRelease) {
            trackArtistStrings[i] = trackArtistNames;
        }

        var trackName = tracks[i].title;
        if (trackName.includes('(feat.') || trackName.includes('[feat.') ||
            trackName.includes('(Feat.') || trackName.includes('[Feat.') ||
            (!vaRelease && artistName !== trackArtistNames)) {
            var features = '';
            if (trackName.includes('(feat.')) {
                features = trackName.substring(trackName.indexOf('(feat.') + 6, trackName.indexOf(')'));
            } else if (trackName.includes('[feat.')) {
                features = trackName.substring(trackName.indexOf('[feat.') + 6, trackName.indexOf(']'));
            } else if (trackName.includes('(Feat.')) {
                features = trackName.substring(trackName.indexOf('(Feat.') + 6, trackName.indexOf(')'));
            } else if (trackName.includes('[Feat.')) {
                features = trackName.substring(trackName.indexOf('[Feat.') + 6, trackName.indexOf(']'));
            } else {
                features = trackArtistNames.replace(artistName + ',', '').replace(artistName + ' &', '').replace(artistName, '').trim();
            }

            var discPrefix = ((discCount == 1) ? '' : discNumbers[i] + '.');
            var splitFeats = features.split(',');
            for (j = 0; j < splitFeats.length; j++) {
                if (splitFeats[j].includes('&')) {
                    var splitFeats2 = splitFeats[j].split('&');

                    var featTrackNums = trackFeats.get(splitFeats2[0].trim());
                    featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                    trackFeats.set(splitFeats2[0].trim(), featTrackNums);
                    featurePadBase = splitFeats2[0].trim().length > featurePadBase ? splitFeats2[0].trim().length : featurePadBase;

                    featTrackNums = trackFeats.get(splitFeats2[1].trim());
                    featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                    trackFeats.set(splitFeats2[1].trim(), featTrackNums);
                    featurePadBase = splitFeats2[1].trim().length > featurePadBase ? splitFeats2[1].trim().length : featurePadBase;
                } else {
                    var featTrackNums = trackFeats.get(splitFeats[j].trim());
                    featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                    trackFeats.set(splitFeats[j].trim(), featTrackNums);
                    featurePadBase = splitFeats[j].trim().length > featurePadBase ? splitFeats[j].trim().length : featurePadBase;
                }
            }
            if (trackName.includes('(feat.')) {
                trackName = trackName.substring(0, trackName.indexOf('(feat.')).trim();
            } else if (trackName.includes('[feat.')) {
                trackName = trackName.substring(0, trackName.indexOf('[feat.')).trim();
            }
        }
        if (albumType.includes('Live')) {
            trackName = trackName.replace('(Live)', '').replace('[Live]', '').trim();
        }
        trackNames[i] = trackName;

        trackDurations[i] = tracks[i].duration === undefined ? "" : new Date(tracks[i].duration).toISOString().slice(14, 19).replace(/^0+/, '');
    }
    featurePadBase++;

    // text output
    output = output + artistName + '\n';
    output = output + albumTitle + '\n';
    output = output + releaseDate + '\n\nType: ';
    output = output + albumType + '\n\n';
    for (i = 0; i < trackNames.length; i++) {
        output = output + ((discCount == 1) ? '' : discNumbers[i] + '.');
        output = output + trackNumbers[i] + '|';
        if (vaRelease) {
            output = output + trackArtistStrings[i] + ' - ';
        }
        output = output + trackNames[i] + '|' + trackDurations[i] + '\n';
    }
    if (trackFeats.size > 0) {
        output = output + '\nTrack Features\n';
        for (let [artist, trackNums] of trackFeats) {
            var padding = '';
            for (i = 0; i < featurePadBase - artist.length; i++) {
                padding = padding + ' ';
            }
            output = output + artist + ': ' + padding + trackNums + '\n';
        }
    }
    output = output + '\n' + copyright + '\n';

    var codeTag = document.getElementById('textOutput');
    codeTag.innerHTML = output;

    // generate cover art html tags
    var coverAnchor = document.createElement('a');
    coverAnchor.id = 'coverAnchor';
    coverAnchor.download = albumTitle + '.jpg';

    var coverImg = document.createElement('img');
    coverImg.onload = function () {
        if (this.naturalWidth < 1000) {
            document.getElementById('coverImg').style.width = this.naturalWidth;
        } else {
            document.getElementById('coverImg').style.width = '100%';
        }
    };
    coverImg.id = 'coverImg';
    coverImg.src = coverArtUrl;
    coverAnchor.appendChild(coverImg);

    // reveal the output in the dom
    var sectionTag = document.getElementById('outputContainer');
    sectionTag.appendChild(coverAnchor);
    sectionTag.style.display = 'block';
}

// from chatgpt
function formatISODurationToTimeString(isoDuration) {
  const regex = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
  const match = isoDuration.match(regex);
  if (!match) return null;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  const padded = (num) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${padded(minutes)}:${padded(seconds)}`;
  } else {
    return `${minutes}:${padded(seconds)}`;
  }
}

// from chatgpt
function formatDateToLongForm(dateStr) {
  const date = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
  return date.toLocaleDateString('en-US', options);
}

// https://stackoverflow.com/a/5574446
String.prototype.toProperCase = function () {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};