function parseHTML() {
    var url = document.getElementById('url').value;

    $.getJSON('https://api.allorigins.win/get?url=' + encodeURIComponent(url), function (data){
        var parser = new DOMParser();
        var doc = parser.parseFromString(data.contents, "text/html");
        var output = '';

        var artistNameAnchor = doc.querySelector('.dt-link-to');
        var artistName = artistNameAnchor.textContent.trim();

        var albumTitleH1 = doc.querySelector('.product-name.typography-title-emphasized.clamp-4');
        var albumTitle = albumTitleH1.textContent.replace('<!---->','').trim();

        var releaseDateP = doc.querySelector('.song-released-container.typography-footnote-emphasized');
        var releaseDate = releaseDateP.textContent.replace('RELEASED','').trim();

        var coverArtDiv = doc.querySelector('.product-lockup__artwork-for-product');
        var srcset = coverArtDiv.children[0].children[1].srcset;
        var firstsize = srcset.match(/\d\d\dw/);
        var coverArtThumbUrl = srcset.substring(0,srcset.indexOf(firstsize)).trim();
        var coverArtUrl = coverArtThumbUrl.replace(/\d\d\dx\d\d\d/,'9999x9999');


        output = output + artistName + '\n';
        output = output + albumTitle + '\n';
        output = output + releaseDate + '\n';

        var codeTag = document.getElementById('textOutput');
        codeTag.innerHTML = output;

        var coverAnchor = document.getElementById('coverAnchor');
        coverAnchor.href = coverArtUrl;
        coverAnchor.download = albumTitle + '.jpg';

        var coverImg = document.getElementById('coverImg');
        coverImg.src = coverArtUrl;
    
        var sectionTag = document.getElementById('outputContainer');
        sectionTag.style.display = 'block';
    });

}