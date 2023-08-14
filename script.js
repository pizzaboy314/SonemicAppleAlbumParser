/*
 * EXAMPLES
 * 
 * EP:
 * https://music.apple.com/us/album/aromatic-ep/1676677919
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
        var artistNameDiv = doc.querySelector('.headings__subtitles');
        var vaRelease = (artistNameDiv.textContent.includes('Various Artists')) ? true : false;
        var artistCount = artistNameDiv.children.length;
        var artistName = "";
        if(artistCount < 2){
            artistName = vaRelease ? 'Various Artists' : artistNameDiv.children[0].textContent.trim();
        } else {
            for (i = 0; i < artistCount; i++) {
                if(i > 0){
                    artistName = (i == artistCount - 1) ? artistName + ' & ' : artistName + ', ';
                } 
                artistName = artistName + artistNameDiv.children[i].textContent.trim();
            }
        }

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

        // TRACK STUFF FROM JSON
        var discCount = 1;

        var serializedServerJsonString = doc.getElementById("serialized-server-data").textContent.trim();
        var serializedServerJson = JSON.parse(serializedServerJsonString);
        var sections = serializedServerJson[0].data.sections;
        var tracks = new Array();
        for (i = 0; i < sections.length; i++) {
            if(sections[i].id.includes('track-list -')){
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

            if(discNumbers[i] > prevDiscNumber){
                discCount++;
            }
            prevDiscNumber = discNumbers[i];

            var trackArtistNames = tracks[i].artistName;
            var containerArtistName = tracks[i].containerArtistName;
            if(vaRelease){
                trackArtistStrings[i] = trackArtistNames;
            }

            var trackName = tracks[i].title;
            if(trackName.includes('(feat.') || trackName.includes('[feat.') ||
                trackName.includes('(Feat.') || trackName.includes('[Feat.') ||
                (!vaRelease && artistName !== trackArtistNames)){
                var features = '';
                if(trackName.includes('(feat.')){
                    features = trackName.substring(trackName.indexOf('(feat.')+6,trackName.indexOf(')'));
                } else if(trackName.includes('[feat.')){
                    features = trackName.substring(trackName.indexOf('[feat.')+6,trackName.indexOf(']'));
                } else if(trackName.includes('(Feat.')){
                    features = trackName.substring(trackName.indexOf('(Feat.')+6,trackName.indexOf(')'));
                } else if(trackName.includes('[Feat.')){
                    features = trackName.substring(trackName.indexOf('[Feat.')+6,trackName.indexOf(']'));
                } else {
                    features = trackArtistNames.replace(artistName+',','').replace(artistName+' &','').replace(artistName,'').trim();
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
                } else if(trackName.includes('[feat.')) {
                    trackName = trackName.substring(0,trackName.indexOf('[feat.')).trim();
                }
            }
            if(albumType.includes('Live')){
                trackName = trackName.replace('(Live)','').replace('[Live]','').trim();
            }
            trackNames[i] = trackName;

            trackDurations[i] = new Date(tracks[i].duration).toISOString().slice(14,19).replace(/^0+/,'');
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