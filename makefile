dev:
	NODE_ENV=development ./node_modules/.bin/babel-watch src/

build:
	./node_modules/.bin/babel src --out-dir .build --source-maps
	cp ./package.json ./.build/package.json || true
	cp ./makefile ./.build/makefile || true
