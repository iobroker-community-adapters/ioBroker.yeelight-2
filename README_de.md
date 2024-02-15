![Logo](admin/yeelight.png)

![Number of Installations](http://iobroker.live/badges/yeelight-2-installed.svg)
![Number of Installations](http://iobroker.live/badges/yeelight-2-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.yeelight-2.svg)](https://www.npmjs.com/package/iobroker.yeelight-2)

![Test and Release](https://github.com/iobroker-community-adapters/ioBroker.yeelight-2/workflows/Test%20and%20Release/badge.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/yeelight-2/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.yeelight-2.svg)](https://www.npmjs.com/package/iobroker.yeelight-2)

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

# ioBroker.yeelight-2

Dieser Adapter steuert Yeelight Lampen. Statusäderungen durch die App werden direkt erkannt.
## Versionsprung
Beim wechsel von der 0.4.X zur 0.9.X oder höher müssen die objekte manuell alle gelöscht werden, damit sie neu erzeugt werden können.

## Installation

Bei vielen Lampem muss über die Yeelight app der Lan Modus aktiviert werden, bevor sie gefunden und gesteuert werden können. 

![](admin/lan.jpg)

## Config
Die Leuchten können manuell hinzugefügt werden oder gesucht werden. Es kann die IP, smartname, port und der Name angepasst werden. Der Standard Port ist 55443. Wird ein Leerzeichen im Namen benutzt wird es ersetzt durch "_". 

Bitte Beachten, dass beim adapterstart alle Lampen eingeschaltet (mit Spannung versorgt sind).

### smartname
Wird ein Smartname in der Config eingegeben, wird diese Lampe automatisch zum Cloud adapter hinzugefügt und kann über alexa gesteuert werden.

### Find device
über diese Funktion können die Lampen automatisch gesucht und hinzugefügt werden. die Suche dauert ca 20 Sekunden. Die gefundenen Geräte werden anschließend in der Tabelle aufgelistet.


## Changelog
Das Änderungsprotokoll findet sich in der Datei README.md