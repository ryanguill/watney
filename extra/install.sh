#these are notes, dont run any of this!

# sudo yum install epel-release -y
# sudo yum install nodejs npm -y
# sudo yum install git -y
# sudo yum install redis -y
# sudo yum install mlocate -y

#git config core.filemode false #ignore permission changes

#chmod +x /opt/watney/extra/deploy.sh

#service redis start
#service redis status
#systemctl enable redis.service

# chown -R watney:watney /opt/watney/

# useradd watney
# groupadd watney
# usermod -G watney watney
# cp -f /opt/watney/extra/watney.service /etc/systemd/system/watney.service && systemctl daemon-reload
# systemctl start watney
# systemctl enable watney

#journalctl --unit=docker