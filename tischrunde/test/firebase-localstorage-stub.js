/*
 * Testhilfe — KEIN Bestandteil der App.
 *
 * Bildet den kleinen Ausschnitt des Firebase-SDK nach, den hosnobe-net.js
 * benutzt, und legt die Daten im localStorage ab. Damit laesst sich der
 * Spieltisch in mehreren Browser-Tabs desselben Geraets durchspielen, bevor
 * ein Firebase-Projekt existiert — und zwar mit demselben Netzcode, der
 * spaeter auch gegen die echte Realtime Database laeuft.
 *
 * Was hier fehlt und absichtlich fehlt: Sicherheitsregeln. Der Schutz der
 * privaten Haende haengt an den Regeln aus der README, nicht an diesem Stub.
 * Er taugt zum Ausprobieren des Spielablaufs, nicht zum Pruefen der Rechte.
 */
(function (root) {
    'use strict';

    var DB_KEY = 'tischrunde.stub.db';
    var UID_KEY = 'tischrunde.stub.uid';
    var CHANNEL = 'tischrunde.stub.ping';

    /* --- Speicher ------------------------------------------------------------ */

    function load() {
        try { return JSON.parse(root.localStorage.getItem(DB_KEY) || '{}'); } catch (e) { return {}; }
    }

    function save(data) {
        root.localStorage.setItem(DB_KEY, JSON.stringify(data));
        // Loest in anderen Tabs das storage-Ereignis aus; im eigenen Tab nicht,
        // deshalb zusaetzlich das eigene Ereignis.
        root.localStorage.setItem(CHANNEL, String(Date.now()));
        root.dispatchEvent(new CustomEvent('tr-stub-change'));
    }

    function segments(path) {
        return String(path).split('/').filter(function (p) { return p.length; });
    }

    function getIn(data, parts) {
        var node = data;
        for (var i = 0; i < parts.length; i++) {
            if (node === null || typeof node !== 'object') return null;
            if (!(parts[i] in node)) return null;
            node = node[parts[i]];
        }
        return node === undefined ? null : node;
    }

    // Leere Knoten verschwinden — genau wie in der Realtime Database.
    function prune(node) {
        if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;
        var keys = Object.keys(node);
        for (var i = 0; i < keys.length; i++) {
            node[keys[i]] = prune(node[keys[i]]);
            if (node[keys[i]] === null) delete node[keys[i]];
        }
        return Object.keys(node).length ? node : null;
    }

    function setIn(data, parts, value) {
        if (!parts.length) return value === null ? {} : value;
        var node = data;
        for (var i = 0; i < parts.length - 1; i++) {
            if (node[parts[i]] === undefined || node[parts[i]] === null || typeof node[parts[i]] !== 'object') {
                node[parts[i]] = {};
            }
            node = node[parts[i]];
        }
        var last = parts[parts.length - 1];
        if (value === null) delete node[last];
        else node[last] = value;
        return data;
    }

    /* --- Momentaufnahme -------------------------------------------------------- */

    function Snapshot(path, value) {
        this._path = path;
        this._value = value === undefined ? null : value;
    }
    Snapshot.prototype.val = function () { return this._value; };
    Snapshot.prototype.exists = function () { return this._value !== null && this._value !== undefined; };
    Snapshot.prototype.child = function (path) {
        return new Snapshot(this._path + '/' + path, getIn({ root: this._value }, ['root'].concat(segments(path))));
    };

    /* --- Referenz -------------------------------------------------------------- */

    var watchers = [];

    function notifyAll() {
        watchers.slice().forEach(function (w) {
            // Je Zuhoerer frisch lesen: ein Zuhoerer darf im Callback selbst
            // schreiben (der Geber teilt genau so aus). Ein einmal oben
            // gelesener Stand waere danach veraltet und wuerde den frischen
            // wieder ueberschreiben.
            var data = load();
            var value = w.path === '.info/connected' ? true : getIn(data, segments(w.path));
            var encoded = JSON.stringify(value === undefined ? null : value);
            if (encoded === w.last) return;
            w.last = encoded;
            w.cb(new Snapshot(w.path, value));
        });
    }

    root.addEventListener('storage', function (e) {
        if (e.key === CHANNEL || e.key === DB_KEY) notifyAll();
    });
    root.addEventListener('tr-stub-change', notifyAll);

    function Ref(path) { this.path = path; }

    Ref.prototype.child = function (sub) {
        return new Ref((this.path ? this.path + '/' : '') + sub);
    };

    Ref.prototype.on = function (event, cb) {
        // last haelt den zuletzt gemeldeten Stand als JSON. Der leere String
        // kommt aus JSON.stringify nie heraus, taugt also als Startwert.
        var w = { path: this.path, cb: cb, last: '' };
        watchers.push(w);
        // Erster Aufruf sofort, wie bei Firebase.
        var value = this.path === '.info/connected' ? true : getIn(load(), segments(this.path));
        w.last = JSON.stringify(value === undefined ? null : value);
        root.setTimeout(function () { cb(new Snapshot(w.path, value)); }, 0);
        return cb;
    };

    Ref.prototype.off = function (event, cb) {
        watchers = watchers.filter(function (w) { return !(w.path === this.path && w.cb === cb); }.bind(this));
    };

    Ref.prototype.once = function () {
        var path = this.path;
        return Promise.resolve(new Snapshot(path, getIn(load(), segments(path))));
    };

    Ref.prototype.set = function (value) {
        var data = load();
        setIn(data, segments(this.path), value === undefined ? null : value);
        save(prune(data) || {});
        return Promise.resolve();
    };

    Ref.prototype.remove = function () { return this.set(null); };

    // Mehrpfad-Schreiben: die Schluessel sind Pfade relativ zu dieser Referenz.
    Ref.prototype.update = function (values) {
        var data = load();
        var base = segments(this.path);
        for (var key in values) {
            if (!values.hasOwnProperty(key)) continue;
            var value = values[key];
            setIn(data, base.concat(segments(key)), value === undefined ? null : value);
        }
        save(prune(data) || {});
        return Promise.resolve();
    };

    Ref.prototype.transaction = function (fn) {
        var data = load();
        var parts = segments(this.path);
        var current = getIn(data, parts);
        var next = fn(current);
        if (next === undefined) {
            return Promise.resolve({ committed: false, snapshot: new Snapshot(this.path, current) });
        }
        setIn(data, parts, next);
        save(prune(data) || {});
        return Promise.resolve({ committed: true, snapshot: new Snapshot(this.path, next) });
    };

    // Ohne echte Verbindung gibt es nichts abzumelden.
    Ref.prototype.onDisconnect = function () {
        return {
            set: function () { return Promise.resolve(); },
            update: function () { return Promise.resolve(); },
            remove: function () { return Promise.resolve(); },
            cancel: function () { return Promise.resolve(); }
        };
    };

    /* --- Aussenseite wie beim SDK ------------------------------------------------ */

    var database = { ref: function (path) { return new Ref(path || ''); } };

    function currentUid() {
        var uid = null;
        try { uid = root.sessionStorage.getItem(UID_KEY); } catch (e) { /* egal */ }
        if (!uid) {
            uid = 'stub' + Math.random().toString(36).slice(2, 10);
            try { root.sessionStorage.setItem(UID_KEY, uid); } catch (e) { /* egal */ }
        }
        return uid;
    }

    var auth = {
        signInAnonymously: function () {
            return Promise.resolve({ user: { uid: currentUid() } });
        }
    };

    root.firebase = {
        apps: [],
        initializeApp: function (config) {
            var app = { name: '[DEFAULT]', options: config || {} };
            root.firebase.apps = [app];
            return app;
        },
        app: function () { return root.firebase.apps[0]; },
        database: function () { return database; },
        auth: function () { return auth; }
    };

    // Beim ersten Laden im Tab aufraeumen, wenn ein Neustart gewuenscht ist.
    root.TischrundeStub = {
        reset: function () {
            try {
                root.localStorage.removeItem(DB_KEY);
                root.sessionStorage.removeItem(UID_KEY);
            } catch (e) { /* egal */ }
            save({});
        },
        dump: load
    };

})(window);
