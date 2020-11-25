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


        output = output + artistName + '\n';
        output = output + albumTitle + '\n';
        output = output + releaseDate + '\n\nType: ';
        output = output + albumType + '\n\n';

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