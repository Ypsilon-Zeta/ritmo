# Ritmo · il tuo Daily OS

Ritmo è un'app per tenere traccia di acqua, workout, lavoro, cose da fare, progetti e faccende di casa, con un punteggio giornaliero che riassume i progressi. Puoi personalizzarla con i tuoi tracker e i tuoi widget, e collegarla a una cartella che altre AI possono leggere e usare per aggiungere dati. Funziona su **Mac** e **iPhone** con lo stesso codice, offline e senza costi.

La schermata **Oggi** mostra la giornata come una fila di passi, come i tasti di una drum machine. Ogni passo si accende quando lo fai, e in grande vedi solo il prossimo (**Adesso**). Se registri l'acqua, un blocco di lavoro, una faccenda o un workout, il passo corrispondente si accende da solo.

---

## Cosa c'è dentro

| Area | Cosa fa | Il dettaglio utile |
|---|---|---|
| **Oggi** | Sequenza di passi della giornata, punteggio, vittorie, inbox veloce | Un passo alla volta: niente liste infinite |
| **Acqua** | Obiettivo giornaliero e tasti rapidi | Ti dice quanto dovresti aver bevuto *a quest'ora* (barretta nera); +500 ml nei giorni di workout |
| **Workout** | Settimana, registrazione in un tocco, storico | **Copertura muscolare**: quanti giorni sono passati da quando hai allenato ogni gruppo |
| **Lavoro** | Timer a blocchi (15′, Pomodoro, Deep 50′, libero) | **Mi sono bloccato**: il blocco diventa un problema annotato e un micro-passo, invece di chiudere la sessione |
| **Da fare** | Inbox unica, Oggi, Prossimi, Matrice di Eisenhower | Scrivi in italiano: `Chiamare il commercialista domani #srl !alta` |
| **Progetti** | Milestone, prossima azione, scadenza, link | **Progetto del giorno a rotazione** (quello lavorato meno di recente; la stella dà la precedenza) |
| **Casa** | Faccende ricorrenti | Ogni barra si svuota col tempo in base alla frequenza: fai la più vuota |
| **Progressi** | Heatmap di 26 settimane, serie, livelli/XP, traguardi | Serie con **giorno jolly**, revisione settimanale del lunedì, obiettivi a lungo termine |

Ci sono anche la revisione serale (la "prima cosa di domani" diventa la tua prima priorità), i comandi rapidi `⌘K`, il tema chiaro/scuro e la sincronizzazione gratuita tra Mac e iPhone.

---

## 1. Provala subito (30 secondi)

Apri `docs/index.html` con un doppio clic: si apre nel browser e funziona.
È solo una prova: i dati restano in quel browser e a quell'indirizzo di file.

## 2. Installala davvero su Mac e iPhone (gratis, circa 5 minuti)

Per avere la stessa app su Mac e iPhone serve un indirizzo web. GitHub Pages lo dà gratis.

**Dal sito di GitHub, senza terminale:**

1. Vai su <https://github.com/new>, chiama il repository `ritmo`, lascialo **Public** e crealo.
   Con l'account gratuito, GitHub Pages funziona solo sui repository pubblici. È pubblico il *codice*, non i tuoi dati: quelli restano sui tuoi dispositivi (ed eventualmente nel tuo Gist segreto).
2. Nella pagina del repository: **Add file → Upload files**. Trascina tutto il contenuto di questa cartella (`README.md`, `docs`, `src`, `tests`, `build.py`, `make_icons.py`) e premi **Commit changes**.
3. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, Branch **main**, cartella **/docs**, poi **Save**.
4. Dopo 1-2 minuti l'app è online su `https://TUO-NOME.github.io/ritmo/`.

**Dal terminale** (un buon esercizio con git e GitHub CLI):

```bash
cd ritmo
git init && git add . && git commit -m "Ritmo 1.0"
gh repo create ritmo --public --source=. --push
gh api -X POST "repos/{owner}/ritmo/pages" -f "source[branch]=main" -f "source[path]=/docs"
```

**Sul Mac, con Chrome (consigliato, serve per la cartella dati):** apri l'indirizzo e clicca l'icona **Installa** nella barra degli indirizzi (oppure menu ⋮ → Trasmetti, salva e condividi → Installa pagina come app). Ritmo diventa un'app nel Dock e in Launchpad, e Chrome ricorda per sempre l'accesso alla cartella.

**Sul Mac, con Safari:** apri l'indirizzo in **Safari → File → Aggiungi al Dock**. Funziona tutto tranne la cartella dati, perché Safari non permette alle web app di scrivere in una cartella. Ritmo diventa un'app con finestra e icona sue, la trovi anche in Launchpad e Spotlight. Serve macOS Sonoma o successivo. Puoi anche metterla tra gli elementi di login, così si apre all'accensione.

**Sull'iPhone:** apri l'indirizzo in **Safari → Condividi → Aggiungi alla schermata Home**, con "Apri come web app" attivo (da iOS 26 è già attivo di default).

> **Perché non un'app nativa?** Con l'account Apple gratuito un'app installata da Xcode smette di aprirsi dopo 7 giorni e va reinstallata. Per tenerla per un anno serve il programma sviluppatori, che costa 99 dollari l'anno. La web app installata è gratuita e non scade mai.

---

## 3. Sincronizzazione Mac ↔ iPhone (opzionale, gratis)

Senza sync, Mac e iPhone hanno dati separati. Con la sync, Ritmo salva tutto in un **Gist segreto** del tuo account GitHub e unisce i dati dei due dispositivi.

1. Crea un token: <https://github.com/settings/tokens/new?scopes=gist&description=Ritmo%20sync> (è già preimpostato con il solo permesso **gist**). Scegli una scadenza e generalo.
2. Su Ritmo vai in **Impostazioni → Sincronizzazione**, incolla il token e premi **Collega**.
3. Fai lo stesso sull'altro dispositivo, con lo stesso token.

Come funziona la sync:

- Si sincronizza all'apertura, qualche secondo dopo ogni modifica e ogni 3 minuti mentre l'app è aperta.
- Ogni elemento (un bicchiere, un'attività, una faccenda) ha la data della sua ultima modifica: se lo modifichi su due dispositivi, vince la versione più recente. Le cancellazioni si propagano.
- Anche il timer è condiviso: se lo avvii sul Mac, lo vedi scorrere sull'iPhone.
- Il **token resta solo sul dispositivo**: non viene salvato nel Gist né nei backup.
- Un Gist segreto non compare in pubblico, ma chi conosce il link può leggerlo e non è cifrato. Non scriverci password o dati sensibili. Puoi revocare il token in qualsiasi momento da GitHub.

---

## 3b. Personalizzazione: cartella dati, inbox, widget, tracker, terminale

### Cartella dati (per altre AI, script ed Excel)
In **Impostazioni → Cartella dati → Scegli cartella** selezioni una cartella, ad esempio `Documenti/Ritmo` o una cartella in iCloud Drive. Da quel momento Ritmo scrive i file dopo ogni modifica e controlla la cartella ogni 20 secondi. Serve Chrome o Edge sul Mac.

```
Ritmo/
├── LEGGIMI.md            ← spiega tutto il formato: dallo da leggere alla tua AI
├── dati/                 ← sola lettura (Ritmo la riscrive)
│   ├── giorni.csv        ← una riga per giorno: punteggio, acqua, lavoro, workout, tracker…
│   ├── acqua.csv  workout.csv  lavoro.csv  attivita.csv  tracker.csv  obiettivi.csv
│   ├── faccende.csv  faccende-storico.csv  progetti.json
│   └── ritmo.json        ← lo stato completo
├── diario.md             ← revisioni serali e settimanali
├── inbox/                ← scrittura: qui altre app/AI aggiungono dati
├── widgets/              ← i tuoi widget .js
└── log/ritmo.log         ← messaggi ed errori del terminale
```

- **Leggere e analizzare:** collega la cartella a Claude (o a qualsiasi AI con accesso ai file) e chiedi ad esempio "analizza giorni.csv: cosa succede al punteggio nei giorni in cui dormo meno di 7 ore?". I CSV usano date AAAA-MM-GG e il punto come separatore decimale, quindi pandas ed Excel li leggono senza conversioni.
- **Scrivere:** un'AI o un'app lascia un file in `inbox/`. Ritmo lo applica e lo sposta in `inbox/elaborati/`.
  - `.md` o `.txt`: ogni riga diventa un'attività (capisce "domani", "#progetto", "!alta").
  - `.json`: azioni come `{"tipo":"acqua","ml":250}`, `{"tipo":"attivita","testo":"..."}`, `{"tipo":"workout","sport":"corsa","minuti":30}`, `{"tipo":"faccenda","nome":"Lavatrice"}`, `{"tipo":"lavoro","minuti":25,"progetto":"..."}`, `{"tipo":"tracker","nome":"sonno","valore":7.5}`. L'elenco completo è in `LEGGIMI.md`.
- `dati/` è una copia che Ritmo riscrive ogni volta: se la modifichi a mano, le modifiche vengono sovrascritte. Per aggiungere dati usa sempre `inbox/`.

### Tracker personalizzati
In **Impostazioni → Tracker personalizzati** puoi aggiungere qualsiasi numero da seguire ogni giorno: sonno, passi, ore di telefono, caffè, pagine lette… Ci sono anche dei preset. "Somma" somma i valori della giornata, "ultimo" tiene l'ultimo valore inserito, e "limite" vuol dire che meno è meglio. I tracker compaiono in Oggi, in `giorni.csv` (una colonna ciascuno) e nell'API dei widget.

### Widget (JavaScript)
Un widget è un riquadro in Oggi. Puoi crearlo in **Impostazioni → Widget → Nuovo widget** (funziona anche su iPhone) oppure come file `.js` in `widgets/`: Ritmo lo ricarica da solo quando salvi il file. I widget si sincronizzano anche su iPhone.

```js
Ritmo.widget({
  title: 'Sonno vs punteggio',
  area: 'progressi',          // colore: acqua, workout, lavoro, todo, progetti, casa, progressi
  size: 2,                    // 1 o 2 colonne
  render(api) {
    const g = api.series(14); // ultimi 14 giorni
    const dati = g.map(d => ({ v: d.tracker.sonno || 0, label: d.label, tip: d.data + ': ' + d.punteggio + ' punti' }));
    return `<div class="val">${api.day().punteggio} <small>punti oggi</small></div>`
      + api.ui.chart(dati, 'var(--progressi)', 8)
      + '<button class="btn tint sm" data-wact="dormito">Ho dormito 8 ore</button>';
  },
  azioni: { dormito(api) { api.add.log('sonno', 8); } },
});
```

| API | Cosa fa |
|---|---|
| `api.day(data?)` / `api.series(n)` | `{ data, label, acqua, obiettivoAcqua, lavoro, workout, attivita, faccende, punteggio, energia, tracker: {id: valore} }` |
| `api.tracker(id)` | valore di oggi di un tracker |
| `api.add.water(ml)` `.task(testo)` `.log(id, valore)` `.chore(nome)` `.workout({tipo, minuti})` | registra dati |
| `api.ui.chart(dati, colore, obiettivo)` `.bar(pct, area)` `.ring(pct)` `.esc(testo)` `.fmtMin` `.fmtMl` | grafica nello stile di Ritmo |
| `api.state` `api.settings` `api.toast(msg)` `api.go(sezione)` `api.log(...)` | accesso completo, notifiche, navigazione, log nel terminale |

Un widget con un errore non blocca l'app: mostra il messaggio nel riquadro e lo scrive nel terminale. Attenzione: i widget sono codice che gira dentro Ritmo, quindi usa solo codice tuo o che hai letto.

### Terminale
Aprilo da **Impostazioni → Terminale**, dal tasto <code>`</code> o da ⌘K. Mostra i messaggi di avvio, sync, cartella e widget, gli errori JavaScript e le promesse rifiutate. Gli ultimi messaggi vengono salvati anche in `log/ritmo.log`, così puoi passarli a un'AI per il debug.

Comandi: `aiuto`, `stato`, `errori`, `sync`, `cartella`, `widget`, `dati <collezione>`, `esporta`, `pulisci`. Qualsiasi altra cosa viene eseguita come JavaScript, ad esempio `Ritmo.api.series(7)` o `Ritmo.state.settings`. Con ↑ e ↓ scorri la cronologia dei comandi.

---

## 4. Promemoria

| Dove | Come | Limite |
|---|---|---|
| **Mac, app aperta** (anche ridotta nel Dock) | Impostazioni → Promemoria → **Attiva notifiche** | Arrivano solo se Ritmo è aperto |
| **iPhone e Mac ad app chiusa** | Impostazioni → **Esporta promemoria (.ics)**. Aprilo sul Mac e importalo in un nuovo calendario iCloud chiamato "Ritmo" | Gli orari sono fissi. Per cambiarli, elimina il calendario "Ritmo" e importa il nuovo file |

I promemoria dentro l'app tengono conto di quello che hai già fatto. Quello dell'acqua arriva solo se sei **indietro rispetto all'orario** e non bevi da un po'. Quello delle faccende arriva solo se ce n'è qualcuna in ritardo. La revisione serale ti viene ricordata solo se non l'hai ancora fatta.

**Perché serve il file calendario:** una web app su iPhone riceve notifiche ad app chiusa solo tramite Web Push (da iOS 16.4), e il Web Push richiede un server. Il calendario fa lo stesso lavoro, gratis e con notifiche native.

---

## 5. Comandi Rapidi, Back Tap e tastiera

| Azione | Indirizzo da usare in "Apri URL" |
|---|---|
| Bevi un bicchiere | `https://TUO-NOME.github.io/ritmo/?add=water&ml=250` |
| Avvia un blocco da 15′ | `https://TUO-NOME.github.io/ritmo/?focus=start` |
| Aggiungi un'attività | `https://TUO-NOME.github.io/ritmo/?task=Comprare%20il%20latte%20domani` |
| Segna una faccenda | `https://TUO-NOME.github.io/ritmo/?chore=lavatrice` |
| Apri una sezione | `https://TUO-NOME.github.io/ritmo/#todo` (anche `#acqua`, `#lavoro`, `#casa`…) |

**Back Tap:** crea in Comandi Rapidi un comando con l'azione "Apri URL", poi vai in Impostazioni → Accessibilità → Tocco → **Tocca il retro** e assegna il comando al doppio tocco. Due colpetti sul retro dell'iPhone e il bicchiere è registrato.
Su iPhone, l'app sulla schermata Home ha **dati separati da Safari**. I link aperti dai Comandi Rapidi si aprono in Safari, quindi per questo uso serve la sync attiva.

**Tastiera sul Mac:** `⌘K` apre i comandi, `1`–`8` le sezioni, `W` registra un bicchiere d'acqua, `N` crea una nuova attività, `F` avvia il timer, `?` apre l'aiuto.

---

## 6. Come si calcola il punteggio

Il punteggio del giorno (0–100) è la media pesata delle aree che contano quel giorno:

| Componente | Peso | Quando conta |
|---|---|---|
| Acqua (bevuta / obiettivo) | 1 | sempre |
| Workout (fatto o no) | 1 | nei giorni previsti, o quando ti alleni |
| Lavoro (minuti / obiettivo) | 1,5 | nei giorni di lavoro |
| Da fare (fatte / fatte + scadute) | 1 | se c'era qualcosa in scadenza |
| Casa (faccende non scadute) | 0,75 | se hai faccende |
| Daily OS (passi fatti, esclusi i saltati) | 1 | se hai passi |

- **Serie:** giorni di fila con almeno 60 punti (la soglia si cambia nelle impostazioni). Un giorno sotto soglia a settimana è coperto da un **jolly**.
- **XP:** 1 per ogni 250 ml d'acqua (+10 se raggiungi l'obiettivo), 25 per un workout, circa ⅔ per ogni minuto di lavoro, 5 per un'attività (10 se ha priorità alta), 8 per una faccenda, 30 per una milestone, 15 per la revisione serale, 30 per la revisione settimanale, +20 per una giornata da 80 punti o più, +40 per una da 100.

---

## 7. Le funzioni e le prove dietro

| Funzione in Ritmo | Su cosa si basa | Tipo di evidenza | Forza |
|---|---|---|---|
| Tracciare i progressi in ogni area | Harkin et al. 2016, *Psychological Bulletin*: meta-analisi di 138 studi (19.951 persone). Monitorare i progressi favorisce il raggiungimento degli obiettivi, di più se i progressi sono registrati o resi pubblici | Meta-analisi di RCT | **Alta** |
| Piano "se… allora" in Acqua, Workout e Lavoro | Gollwitzer e Sheeran 2006: 94 test indipendenti, effetto d = 0,65 | Meta-analisi | **Alta** |
| Serie con giorno jolly | Silverman e Barasch 2023, *JCR*: una serie spezzata riduce l'impegno successivo, ma l'effetto si attenua se la serie si può "riparare". Lally et al. 2010: abitudine in 66 giorni di mediana (da 18 a 254); saltare una volta non compromette il processo | Esperimenti online; studio osservazionale (n=96) | **Media** |
| Revisione del lunedì / inizio mese | Dai, Milkman e Riis 2014: i "nuovi inizi" (settimana, mese) aumentano i comportamenti verso gli obiettivi | Studi d'archivio; l'effetto è breve | **Media** |
| Vittorie di oggi, milestone | Amabile e Kramer 2011: circa 12.000 diari; il progresso in un lavoro che senti importante è il motore principale della motivazione | Diari, correlazionale | **Media-bassa** |
| XP, livelli, traguardi | Mazeas et al. 2022, *JMIR*: effetto piccolo-medio della gamification sull'attività fisica (16 RCT), più fragile nel lungo periodo | Meta-analisi | **Media-bassa**: un aiuto, non lo scopo |
| Blocchi da 15′ e pause fisse | Biwer et al. 2023: pause fisse associate a umore migliore e stessa resa in meno tempo. Smits et al. 2025: più fatica rispetto alle pause libere | Studi su studenti, risultati discordanti | **Bassa / mista**: scegli tu la modalità |
| Obiettivo acqua 2 L + extra nei giorni di workout | EFSA: circa 2,5 L di acqua *totale* al giorno per un uomo adulto, cibo compreso | Valore di riferimento | Riferimento, non una prescrizione |
| Inbox unica, regola dei 2 minuti, Daily OS sequenziale | Pratiche di produttività (GTD) | Aneddotica, senza RCT dedicati | **Bassa**: tienile se ti funzionano |

---

## 8. Dati, backup e privacy

- I dati stanno nel browser del dispositivo (`localStorage`) e, se la attivi, nel tuo Gist.
- **Impostazioni → Dati e backup**: esporta un file `.json` ogni tanto. L'import lo unisce ai dati esistenti, senza sovrascriverli.
- Prima di ogni sincronizzazione che cambia qualcosa, Ritmo tiene una copia dello stato precedente ("Ripristina prima dell'ultima sync").
- Su iPhone, le web app aggiunte alla schermata Home non sono soggette alla cancellazione automatica dei dati dopo 7 giorni che Safari applica ai siti. Un backup ogni tanto resta comunque una buona idea.

---

## 9. Modificare l'app (anche con Claude Code)

```
ritmo/
├── docs/            ← l'app pronta (pubblicata da GitHub Pages)
├── src/
│   ├── core.js      ← logica pura: date, sync/merge, punteggio, serie, XP, parser, .ics
│   ├── ui1.js       ← base dell'interfaccia, Oggi, Acqua, Workout
│   ├── ui2.js       ← Lavoro, Da fare, Progetti, Casa
│   ├── ui3.js       ← Progressi, Impostazioni, revisioni, sync, promemoria
│   ├── ui4.js       ← terminale, cartella dati, inbox, tracker, widget, avvio
│   ├── styles.css   ← design (colori, componenti)
│   ├── shell.html   ← scheletro della pagina
│   └── sw.js        ← funzionamento offline
├── tests/           ← test automatici
├── build.py         ← unisce src/ in docs/index.html
└── make_icons.py    ← genera le icone
```

1. Modifica i file in `src/`.
2. Ricostruisci con `python3 build.py`.
3. Verifica:
   - `node tests/core.test.js`: logica (14 test).
   - `pip3 install playwright` e poi `python3 tests/e2e.py`: prova l'app in un vero Chrome (36 controlli). Se non hai Chrome, prima esegui `python3 -m playwright install chromium`.
   - `python3 tests/sync_e2e.py`: sync tra due "dispositivi" con un GitHub simulato (12 controlli).
   - `python3 tests/folder_e2e.py`: cartella, inbox, widget, tracker e terminale (19 controlli).
4. Quando pubblichi una nuova versione, aumenta `VERSION` in `src/ui1.js`: così Mac e iPhone scaricano subito l'aggiornamento invece della copia offline.

## Limiti noti

- Su iPhone non ci sono notifiche ad app chiusa senza il file calendario, perché servirebbe un server per il Web Push.
- Nella sync vince la modifica più recente di ogni elemento. Se modifichi lo *stesso* elemento su due dispositivi senza connessione, resta l'ultima versione.
- Il `localStorage` ha circa 5 MB: bastano per anni di dati, ma esporta un backup ogni tanto.
