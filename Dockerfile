FROM ubuntu:20.04

LABEL maintainer="Paul Visco <paul.visco@gmail.com>"

#####################################################################
#
# A Docker image to convert audio and video for web using web API
#
#   with
#     - FFMPEG (built from source)
#     - NodeJS
#     - fluent-ffmpeg
#
#   For more on Fluent-FFMPEG, see 
#
#            https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
#
#####################################################################

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV FFMPEG_VERSION=4.4

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    curl \
    pkg-config \
    yasm \
    nasm \
    libx264-dev \
    libx265-dev \
    libvpx-dev \
    libfdk-aac-dev \
    libmp3lame-dev \
    libopus-dev \
    libvorbis-dev \
    libass-dev \
    libfreetype6-dev \
    libfontconfig1-dev \
    libsdl2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install FFmpeg
RUN cd /tmp \
    && wget https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2 \
    && tar xjf ffmpeg-${FFMPEG_VERSION}.tar.bz2 \
    && cd ffmpeg-${FFMPEG_VERSION} \
    && ./configure \
        --prefix=/usr \
        --enable-gpl \
        --enable-libfdk-aac \
        --enable-libfreetype \
        --enable-libmp3lame \
        --enable-libopus \
        --enable-libvorbis \
        --enable-libvpx \
        --enable-libx264 \
        --enable-libx265 \
        --enable-nonfree \
        --enable-shared \
    && make -j$(nproc) \
    && make install \
    && ldconfig \
    && cd / \
    && rm -rf /tmp/ffmpeg-${FFMPEG_VERSION}*

# Install fluent-ffmpeg globally
RUN npm install -g fluent-ffmpeg

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app
RUN npm install

# Bundle app source
COPY . /usr/src/app

# Create uploads directory
RUN mkdir -p /usr/src/app/uploads

EXPOSE 3000
CMD [ "node", "app.js" ]