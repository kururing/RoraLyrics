/** Uppercases the first Unicode letter while preserving leading punctuation. */
export const capitalizeFirstLetter = (text: string): string =>
	text.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase());
