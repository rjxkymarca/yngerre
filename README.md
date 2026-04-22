# YNG ERRE Player

Progetto Angular pensato per il deploy su Vercel e disegnato come experience player ispirata ad Apple Music.

## Avvio locale

```bash
npm install
npm start
```

Apri `http://localhost:4200`.

## Build

```bash
npm run build
```

## Deploy su Vercel

Vercel rileva automaticamente Angular. Hai due opzioni:

```bash
npm i -g vercel
vercel
```

oppure importi la repository dal pannello Vercel.

## Dove aggiornare i contenuti

I contenuti del player sono centralizzati in:

- `src/app/app.ts`: tracce, link Apple Music, query YouTube, release pubbliche.

## Nota sugli embed YouTube

In questa sessione YouTube restituisce la schermata di consenso invece dei metadati pubblici del canale, quindi il player usa un fallback tramite ricerca `artista + titolo` su YouTube embed. Se vuoi precisione assoluta, sostituisci le `youtubeSearch` con ID video specifici quando li hai a disposizione.
