import {test} from 'node:test';import assert from 'node:assert/strict';import {numberFr,croupierCall} from '../src/voice';
test('Croupier-Ansage auf Französisch: Zahl, Farbe, pair/impair, manque/passe',()=>{
 assert.equal(numberFr(21),'vingt et un');assert.equal(numberFr(17),'dix-sept');assert.equal(numberFr(36),'trente-six');assert.equal(numberFr(30),'trente');
 assert.equal(croupierCall(17),'Dix-sept, noir, impair et manque.');assert.equal(croupierCall(32),'Trente-deux, rouge, pair et passe.');assert.equal(croupierCall(0),'Zéro.');
 for(let n=1;n<=36;n++)assert.match(croupierCall(n),/^[A-ZÉ].+, (rouge|noir), (pair|impair) et (manque|passe)\.$/);});
