/**
 * Formatering av adresser for visning.
 */

/**
 * Normaliserer adresse slik at:
 *  - Første bokstav i strengen er stor
 *  - Bokstaver i husnummer (f.eks. "97b") kapitaliseres til "97B"
 *
 * Bevarer resten av casingen ellers (så "Olav V's gate" forblir uendret,
 * mens "kjelsåsveien 97b" blir "Kjelsåsveien 97B").
 */
export function capitalizeAdresse(adresse: string | null | undefined): string {
  if (!adresse) return '';
  const trimmed = adresse.trim();
  if (trimmed.length === 0) return '';
  const firstUpper = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return firstUpper.replace(
    /(\d+)([a-zæøå])(?![a-zæøåA-ZÆØÅ])/g,
    (_m, num, letter) => num + letter.toUpperCase(),
  );
}
