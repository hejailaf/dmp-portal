<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PM DataCare</title>
    <script>
      // apply the saved (or OS-preferred) theme before first paint — no flash
      try {
        var t = localStorage.getItem('dmp-theme')
        if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches))
          document.documentElement.classList.add('dark')
      } catch (e) {}
    </script>
    <script type="module" crossorigin src="./assets/index.js?v=202607181349"></script>
    <link rel="modulepreload" crossorigin href="./assets/client.js?v=202607181349">
    <link rel="stylesheet" crossorigin href="./assets/index.css?v=202607181349">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
