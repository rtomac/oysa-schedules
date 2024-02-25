SHELL=/bin/bash

.PHONY: setup
setup:
	clasp login -P ./src

.PHONY: push
push:
	clasp push -P ./src

.PHONY: pull
pull:
	clasp pull -P ./src

.PHONY: open
open:
	clasp open -P ./src
