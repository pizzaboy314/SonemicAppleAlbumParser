function parseHTML() {
    var url = document.getElementById('url').value;

    $.getJSON('http://www.whateverorigin.org/get?url=' + encodeURIComponent(url) + '&callback=?', function(data){
        var parser = new DOMParser();
        var doc = parser.parseFromString(data.contents, "text/html");
        var output = '';

        var artistNameAnchor = doc.querySelector('.dt-link-to');
        var artistName = artistNameAnchor.textContent.trim();

        var albumTitleH1 = doc.querySelector('.product-name.typography-title-emphasized.clamp-4');
        var albumTitle = albumTitleH1.textContent.replace('<!---->','').trim();

        var releaseDateP = doc.querySelector('.song-released-container.typography-footnote-emphasized');
        var releaseDate = releaseDateP.textContent.replace('RELEASED','').trim();
        


        output = output + artistName + '\n';
        output = output + albumTitle + '\n';
        output = output + releaseDate + '\n';

        var codeTag = document.getElementById('textOutput');
        codeTag.innerHTML = output;
    
        var preTag = document.getElementById('outputContainer');
        preTag.style.display = 'block';
    });


}