/**
 * Ingang voor Vercel. Daar draait geen doorlopende server maar wordt per
 * verzoek een functie gestart, dus we luisteren hier niet op een poort — we
 * geven alleen de app door als afhandelaar.
 *
 * Het klopje voor herinneringen komt van een taak in de database, die elke
 * minuut /api/cron/tick aanroept. Zie de README.
 */
import app from '../src/server.js';

export default app;
