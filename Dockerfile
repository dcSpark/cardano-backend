FROM node:14.17.6-alpine3.13

#Install PM2
RUN npm install pm2 -g


# Create app directory
WORKDIR /app

RUN apk add git
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY . .

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source

EXPOSE 8082
CMD ["pm2-runtime", "--json", "pm2.yaml"]

