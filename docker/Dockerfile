FROM eclipse-temurin:17-jre
WORKDIR /opt/repoio
COPY repoio-service/target/repoio-service-*.jar app.jar
COPY repoio-service/src/main/resources/config.yml config.yml
EXPOSE 8585 8586
ENTRYPOINT ["java","-jar","app.jar","server","config.yml"]
