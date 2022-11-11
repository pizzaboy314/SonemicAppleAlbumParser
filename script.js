/*
 * EXAMPLES
 * 
 * EP:
 * https://music.apple.com/us/album/aromatic-ep/1325214121
 * 
 * Features: 
 * https://music.apple.com/us/album/to-pimp-a-butterfly/974187289
 * 
 * Foreign Characters:
 * https://music.apple.com/us/album/pedro-alt%C3%A9rio-bruno-piazza/577195766
 * 
 * Two Disc:
 * https://music.apple.com/us/album/why-mountains-are-black-primeval-greek-village-music/1069921584
 * 
 * Various Artists:
 * https://music.apple.com/us/album/cyberpunk-2077-more-music-from-night-city-radio-original/1558984869
 */

function parseHTML() {
    var url = document.getElementById('url').value;

    $.getJSON('https://api.allorigins.win/get?url=' + encodeURIComponent(url), function (data){
        var parser = new DOMParser();
        var doc = parser.parseFromString(data.contents, "text/html");

        // cleanup cover art elements from previous runs
        var oldCoverArtAnchor = document.getElementById('coverAnchor');
        if(oldCoverArtAnchor != null){
            oldCoverArtAnchor.remove();
        }

        var albumType = 'Album';
        var output = '';

        // artist name
        var artistNameP = doc.querySelector('.headings__subtitles');
        var vaRelease = (artistNameP.textContent.includes('Various Artists')) ? true : false;
        var artistName = vaRelease ? 'Various Artists' : artistNameP.children[0].textContent.trim();


        // album title
        var albumTitle = '';
        var albumTitleH1 = doc.querySelector('.headings__title');
        var albumTitleText = albumTitleH1.textContent.replace('<!---->','').trim();
        if((new RegExp('- EP$')).test(albumTitleText.toUpperCase())){
            albumType = 'EP';
            albumTitle = albumTitleText.replace(/- EP/,'').replace(/- Ep/,'').replace(/- ep/,'').trim();
        } else if(albumTitleText.includes('(Live)') || albumTitleText.includes('[Live]')){
            albumType = 'Live Album';
            albumTitle = albumTitleText.replace('(Live)','').replace('[Live]','').trim();
        } else {
            albumTitle = albumTitleText;
        }

        // release date
        var releaseDateCopyrightDiv = doc.querySelector('.footer-body');
        var releaseDateCopyrightP = releaseDateCopyrightDiv.children[0];
        var releaseDateCopyright = releaseDateCopyrightP.textContent.split(/\r?\n/);
        var releaseDate = releaseDateCopyright[0].replace('<!---->','').trim().toProperCase();
        var copyright = '';
        for (i = 0; i < releaseDateCopyright.length; i++) {
            if(i > 1){
                copyright = copyright + releaseDateCopyright[i].trim().toProperCase().replace('Llc','LLC') + '\n';
            }

        }            

        // cover art img
        var coverArtDiv = doc.querySelector('.artwork__radiosity');
        var srcset = coverArtDiv.children[0].children[0].children[0].srcset;
        var firstsize = srcset.match(/\d\d\dw/);
        var coverArtThumbUrl = srcset.substring(0,srcset.indexOf(firstsize)).trim();
        var coverArtUrl = coverArtThumbUrl.replace(/\d\d\dx\d\d\d/,'9999x9999').replace('webp','jpg');

        // track numbers + disc number if applicable
        var discCount = 1;
        var trackNumberDivs = doc.querySelectorAll('.songs-list-row__song-index');
        var trackNumbers = new Array(trackNumberDivs.length);
        var discNumbers = new Array(trackNumberDivs.length);
        var prevTrackNumber = 1;
        for (i = 0; i < trackNumberDivs.length; i++) {
            trackNumbers[i] = trackNumberDivs[i].children[0].textContent.trim();
            if(parseInt(trackNumbers[i], 10) < prevTrackNumber){
                discCount++;
            }
            discNumbers[i] = discCount;
            prevTrackNumber = parseInt(trackNumbers[i], 10);
        }

        // track names
        var trackNameDivs = doc.querySelectorAll('.songs-list-row__song-name');
        var trackNames = new Array(trackNameDivs.length);
        var trackFeats = new Map();
        var featurePadBase = 0;
        for (i = 0; i < trackNameDivs.length; i++) {
            var trackName = trackNameDivs[i].textContent.trim();
            if(trackName.includes('(feat.') || trackName.includes('[feat.')){
                var features = '';
                if(trackName.includes('(feat.')){
                    features = trackName.substring(trackName.indexOf('(feat.')+6,trackName.indexOf(')'));
                } else {
                    features = trackName.substring(trackName.indexOf('[feat.')+6,trackName.indexOf(']'));
                }

                var discPrefix = ((discCount == 1) ? '' : discNumbers[i] + '.');
                var splitFeats = features.split(',');
                for(j = 0; j < splitFeats.length; j++){
                    if(splitFeats[j].includes('&')){
                        var splitFeats2 = splitFeats[j].split('&');

                        var featTrackNums = trackFeats.get(splitFeats2[0].trim());
                        featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                        trackFeats.set(splitFeats2[0].trim(),featTrackNums);
                        featurePadBase = splitFeats2[0].trim().length > featurePadBase ? splitFeats2[0].trim().length : featurePadBase;

                        featTrackNums = trackFeats.get(splitFeats2[1].trim());
                        featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                        trackFeats.set(splitFeats2[1].trim(),featTrackNums);
                        featurePadBase = splitFeats2[1].trim().length > featurePadBase ? splitFeats2[1].trim().length : featurePadBase;
                    } else {
                        var featTrackNums = trackFeats.get(splitFeats[j].trim());
                        featTrackNums = featTrackNums != null ? featTrackNums + ',' + discPrefix + trackNumbers[i] : discPrefix + trackNumbers[i];
                        trackFeats.set(splitFeats[j].trim(),featTrackNums);
                        featurePadBase = splitFeats[j].trim().length > featurePadBase ? splitFeats[j].trim().length : featurePadBase;
                    }
                }
                if(trackName.includes('(feat.')){
                    trackName = trackName.substring(0,trackName.indexOf('(feat.')).trim();
                } else {
                    trackName = trackName.substring(0,trackName.indexOf('[feat.')).trim();
                }
            }
            if(albumType.includes('Live')){
                trackName = trackName.replace('(Live)','').replace('[Live]','').trim();
            }
            trackNames[i] = trackName;
        }
        featurePadBase++;

        // track artists, for various artists
        var trackArtistDivs = doc.querySelectorAll('.songs-list-row__by-line');
        var trackArtistStrings = new Array(trackNames.length);
        if(vaRelease){
            for (i = 0; i < trackArtistDivs.length; i++) {
                var currSpan = trackArtistDivs[i].children[0];
                var numArtistsDoubled = currSpan.children.length;
                var trackArtistString = '';
                for(j = 0; j < numArtistsDoubled; j=j+2){
                    trackArtistString = trackArtistString + currSpan.children[j].textContent.trim();
                    if(j < (numArtistsDoubled - 4)){
                        trackArtistString = trackArtistString + ', ';
                    } else if(j == (numArtistsDoubled - 4)){
                        trackArtistString = trackArtistString + ' & ';
                    }  
                }
                trackArtistStrings[i] = trackArtistString;
            }
        }
        
        // track durations
        var trackDurationDivs = doc.querySelectorAll('.songs-list-row__length');
        var trackDurations = new Array(trackDurationDivs.length);
        for (i = 0; i < trackDurationDivs.length; i++) {
            trackDurations[i] = trackDurationDivs[i].textContent.trim();
        }

        // text output
        output = output + artistName + '\n';
        output = output + albumTitle + '\n';
        output = output + releaseDate + '\n\nType: ';
        output = output + albumType + '\n\n';
        for (i = 0; i < trackNames.length; i++) {
            output = output + ((discCount == 1) ? '' : discNumbers[i] + '.');
            output = output + trackNumbers[i] + '|';
            if(vaRelease){
                output = output + trackArtistStrings[i] + ' - ';
            }
            output = output + trackNames[i] + '|' + trackDurations[i] + '\n';
        }
        if(trackFeats.size > 0){
            output = output + '\nTrack Features\n';
            for(let [artist,trackNums] of trackFeats){
                var padding = '';
                for(i = 0; i < featurePadBase - artist.length; i++){
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
        coverAnchor.href = coverArtUrl;
        coverAnchor.download = albumTitle + '.jpg';

        var coverImg = document.createElement('img');
        coverImg.onload = function(){
            if(this.naturalWidth < 1000){
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
    });

}
// https://stackoverflow.com/a/5574446
String.prototype.toProperCase = function () {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};