dev:
	NODE_ENV=development ./node_modules/.bin/babel-watch src/

do-build:
	./node_modules/.bin/babel src --out-dir .build --source-maps
	cp ./package.json ./.build/package.json || true
	cp ./makefile ./.build/makefile || true

build:
	./node_modules/.bin/babel src --out-dir .build --source-maps
	cp ./package.json ./.build/package.json || true
	cp ./makefile ./.build/makefile || true

deploy-prod:
	@make build
	docker build -t 180g/bender .
	eval $(aws ecr get-login --region eu-west-1)
	docker tag 180g/bender:latest 094204277459.dkr.ecr.eu-west-1.amazonaws.com/180g/bender:latest
	docker push 094204277459.dkr.ecr.eu-west-1.amazonaws.com/180g/bender:latest
	kubectl --context k8s.180-g.com patch deployment bender -p "{\"spec\":{\"template\":{\"metadata\":{\"labels\":{\"date\":\"`date +'%s'`\"}}}}}" --namespace api
