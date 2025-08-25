# WhiteInfoBox Animasjonsløsning med clip-path

Dette dokumentet inneholder den alternative animasjonsløsningen som bruker CSS clip-path for smooth høyde- og breddeanimasjon.

## Problemet som ble løst
- Høyde-animasjonen "hoppet" når boksen krympet
- Bredde-animasjonen var ikke smooth
- SVG viewBox kan ikke animeres med CSS transition

## Løsningen
Bruker CSS `clip-path` med `inset()` for å klippe div-en gradvis:

### Hovedendringer i WhiteInfoBox.tsx:

1. **Div-en har alltid full størrelse (840x790px)**:
```jsx
<div
  style={{
    position: 'absolute',
    left: 'calc(50% - 235.5px - 74px - 336px)',
    bottom: `${expandedBottom}px`,
    width: 840,
    height: 790,
    clipPath: isExpanded 
      ? 'inset(0 0 0 0)' 
      : 'inset(90px 504px 0 0)',
    opacity: showHeader ? 1 : 0,
    transition: `opacity 1s ease-in-out 0.5s, clip-path 0.8s ease-in-out`,
    zIndex: 1000,
    overflow: 'hidden'
  }}
>
```

2. **SVG har også alltid full størrelse**:
```jsx
<svg
  width="840"
  height="790"
  viewBox={`0 -90 840 790`}
  preserveAspectRatio="xMinYMin meet"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  style={{
    position: 'absolute',
    bottom: 0,
    left: 0,
  }}
>
  <rect width="840" height="790" y="-90" fill="white"/>
```

## Hvordan det fungerer

### Kollapset tilstand:
- `clip-path: inset(90px 504px 0 0)`
- Klipper bort 90px fra toppen (reduserer høyde til 700px)
- Klipper bort 504px fra høyre (reduserer bredde til 336px)

### Ekspandert tilstand:
- `clip-path: inset(0 0 0 0)`
- Viser hele div-en (840x790px)

### Animasjon:
- `transition: clip-path 0.8s ease-in-out`
- Smooth overgang mellom de to clip-path verdiene

## Fordeler
1. Smooth animasjon i både høyde og bredde samtidig
2. Ingen "hopp" eller brå endringer
3. Bruker kun CSS, ingen kompleks JavaScript-logikk
4. Fungerer likt både ved ekspansjon og kollaps

## Ulemper
1. Div-en og SVG-en tar alltid opp full plass i DOM (selv om den er klippet)
2. Kan påvirke ytelse på svake enheter
3. Krever nøyaktig beregning av clip-verdier ved endringer

## Tilbakestilling
For å gå tilbake til original løsning, reverser følgende endringer:
1. Fjern clip-path fra div style
2. Endre width tilbake til `currentWidth` og height til `expandHeight ? 790 : 700`
3. Endre SVG width/height/viewBox tilbake til dynamiske verdier