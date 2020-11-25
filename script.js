function parseHTML() {
    var url = document.getElementById('url').value;

    $.getJSON('https://api.allorigins.win/get?url=' + encodeURIComponent(url), function (data){
        var parser = new DOMParser();
        var doc = parser.parseFromString(data.contents, "text/html");

        var oldCoverArtAnchor = document.getElementById('coverAnchor');
        if(oldCoverArtAnchor != null){
            oldCoverArtAnchor.remove();
        }

        var albumType = 'Album';
        var output = '';

        var artistNameAnchor = doc.querySelector('.dt-link-to');
        var artistName = artistNameAnchor.textContent.trim();

        var albumTitle = '';
        var albumTitleH1 = doc.querySelector('.product-name.typography-title-emphasized.clamp-4');
        var albumTitleText = albumTitleH1.textContent.replace('<!---->','').trim();
        if(albumTitleText.includes('EP')){
            albumType = 'EP';
            albumTitle = albumTitleText.replace(/- EP/,'').trim();
        } else {
            albumTitle = albumTitleText;
        }

        var releaseDateP = doc.querySelector('.song-released-container.typography-footnote-emphasized');
        var releaseDate = releaseDateP.textContent.replace('RELEASED','').trim();

        var coverArtDiv = doc.querySelector('.product-lockup__artwork-for-product');
        var srcset = coverArtDiv.children[0].children[1].srcset;
        var firstsize = srcset.match(/\d\d\dw/);
        var coverArtThumbUrl = srcset.substring(0,srcset.indexOf(firstsize)).trim();
        var coverArtUrl = coverArtThumbUrl.replace(/\d\d\dx\d\d\d/,'9999x9999');

        var trackNameDivs = doc.querySelectorAll('.song-name.typography-label');
        var trackNames = new Array(trackNameDivs.length);
        for (i = 0; i < trackNameDivs.length; i++) {
            trackNames[i] = trackNameDivs[i].textContent.replace('<!---->','').trim();
        }

        var discCount = 1;
        var trackNumberDivs = doc.querySelectorAll('.song-index');
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
        
        var trackDurationDivs = doc.querySelectorAll('.time-data');
        var trackDurations = new Array(trackDurationDivs.length);
        for (i = 0; i < trackDurationDivs.length; i++) {
            trackDurations[i] = trackDurationDivs[i].textContent.trim();
        }

        output = output + artistName + '\n';
        output = output + albumTitle + '\n';
        output = output + releaseDate + '\n\nType: ';
        output = output + albumType + '\n\n';
        for (i = 0; i < trackNames.length; i++) {
            output = output + ((discCount == 1) ? '' : discNumbers[i] + '.');
            output = output + trackNumbers[i] + '|' + trackNames[i] + '|' + trackDurations[i] + '\n';
        }

        var codeTag = document.getElementById('textOutput');
        codeTag.innerHTML = output;

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
    
        var sectionTag = document.getElementById('outputContainer');
        sectionTag.appendChild(coverAnchor);
        sectionTag.style.display = 'block';
    });

}